# Bundle Stats Action エラーハンドリング設計書

## 1. エラー分類と対応方針

### 1.1 エラーレベル定義

| レベル  | 説明               | アクション               | 終了コード |
| ------- | ------------------ | ------------------------ | ---------- |
| FATAL   | 回復不可能なエラー | `core.setFailed()`で終了 | 1          |
| ERROR   | 部分的な失敗       | 警告後、可能な範囲で継続 | 0          |
| WARNING | 軽微な問題         | ログ出力のみ             | 0          |
| INFO    | 情報通知           | デバッグログ             | 0          |

### 1.2 エラーコード体系

```typescript
enum ErrorCode {
  // ファイル関連 (1xxx)
  FILE_NOT_FOUND = 'E1001',
  FILE_READ_ERROR = 'E1002',
  FILE_PERMISSION_DENIED = 'E1003',

  // JSON解析関連 (2xxx)
  JSON_PARSE_ERROR = 'E2001',
  JSON_SCHEMA_INVALID = 'E2002',
  JSON_MISSING_REQUIRED = 'E2003',

  // 解析関連 (3xxx)
  ANALYSIS_FAILED = 'E3001',
  THRESHOLD_CALCULATION_ERROR = 'E3002',

  // GitHub API関連 (4xxx)
  API_AUTHENTICATION_FAILED = 'E4001',
  API_PERMISSION_DENIED = 'E4002',
  API_RATE_LIMIT_EXCEEDED = 'E4003',
  API_NOT_FOUND = 'E4004',
  API_SERVER_ERROR = 'E4005',

  // 設定関連 (5xxx)
  CONFIG_INVALID_INPUT = 'E5001',
  CONFIG_MISSING_REQUIRED = 'E5002',

  // 実行環境関連 (6xxx)
  ENV_NOT_PR_CONTEXT = 'E6001',
  ENV_MISSING_TOKEN = 'E6002'
}
```

## 2. カスタムエラークラス

### 2.1 基底エラークラス

```typescript
export class BundleStatsError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly level: 'fatal' | 'error' | 'warning' | 'info',
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'BundleStatsError'
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      level: this.level,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString()
    }
  }
}
```

### 2.2 特化型エラークラス

```typescript
// ファイル関連エラー
export class FileError extends BundleStatsError {
  constructor(
    message: string,
    code: ErrorCode,
    public readonly path: string,
    details?: unknown
  ) {
    super(message, code, 'fatal', details)
    this.name = 'FileError'
  }
}

// API関連エラー
export class GitHubAPIError extends BundleStatsError {
  constructor(
    message: string,
    code: ErrorCode,
    public readonly status?: number,
    public readonly response?: unknown
  ) {
    super(message, code, 'error', { status, response })
    this.name = 'GitHubAPIError'
  }
}

// 検証エラー
export class ValidationError extends BundleStatsError {
  constructor(
    message: string,
    code: ErrorCode,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message, code, 'fatal', { field, value })
    this.name = 'ValidationError'
  }
}
```

## 3. エラーハンドリングパターン

### 3.1 ファイル読み込みエラー

```typescript
async function readStatsFile(path: string): Promise<string> {
  try {
    // パス検証
    if (!path || typeof path !== 'string') {
      throw new ValidationError(
        'Stats file path must be a non-empty string',
        ErrorCode.CONFIG_INVALID_INPUT,
        'stats-path',
        path
      )
    }

    // セキュリティチェック
    if (path.includes('..') || path.startsWith('/')) {
      throw new FileError(
        'Invalid file path: Path traversal detected',
        ErrorCode.FILE_PERMISSION_DENIED,
        path
      )
    }

    // ファイル存在確認
    if (!fs.existsSync(path)) {
      throw new FileError(
        `Stats file not found: ${path}`,
        ErrorCode.FILE_NOT_FOUND,
        path
      )
    }

    // ファイル読み込み
    const content = await fs.promises.readFile(path, 'utf-8')

    if (!content || content.trim().length === 0) {
      throw new FileError(
        'Stats file is empty',
        ErrorCode.FILE_READ_ERROR,
        path
      )
    }

    return content
  } catch (error) {
    // 既知のエラーは再スロー
    if (error instanceof BundleStatsError) {
      throw error
    }

    // システムエラーをラップ
    if (error instanceof Error) {
      throw new FileError(
        `Failed to read stats file: ${error.message}`,
        ErrorCode.FILE_READ_ERROR,
        path,
        error
      )
    }

    // 未知のエラー
    throw new BundleStatsError(
      'Unknown error reading stats file',
      ErrorCode.FILE_READ_ERROR,
      'fatal',
      error
    )
  }
}
```

### 3.2 JSON解析エラー

```typescript
function parseStatsJSON(content: string): WebpackStats {
  try {
    // 基本的なJSON解析
    const parsed = JSON.parse(content)

    // スキーマ検証
    if (!parsed || typeof parsed !== 'object') {
      throw new ValidationError(
        'Stats must be a valid JSON object',
        ErrorCode.JSON_SCHEMA_INVALID,
        'root',
        parsed
      )
    }

    if (!Array.isArray(parsed.assets)) {
      throw new ValidationError(
        'Stats must contain an assets array',
        ErrorCode.JSON_MISSING_REQUIRED,
        'assets',
        parsed.assets
      )
    }

    // アセット検証
    for (const [index, asset] of parsed.assets.entries()) {
      if (!asset.name || typeof asset.name !== 'string') {
        throw new ValidationError(
          `Asset at index ${index} must have a name`,
          ErrorCode.JSON_SCHEMA_INVALID,
          `assets[${index}].name`,
          asset
        )
      }

      if (typeof asset.size !== 'number' || asset.size < 0) {
        throw new ValidationError(
          `Asset "${asset.name}" has invalid size`,
          ErrorCode.JSON_SCHEMA_INVALID,
          `assets[${index}].size`,
          asset.size
        )
      }
    }

    return parsed as WebpackStats
  } catch (error) {
    if (error instanceof BundleStatsError) {
      throw error
    }

    if (error instanceof SyntaxError) {
      throw new BundleStatsError(
        `Invalid JSON: ${error.message}`,
        ErrorCode.JSON_PARSE_ERROR,
        'fatal',
        { content: content.substring(0, 100) }
      )
    }

    throw new BundleStatsError(
      'Failed to parse stats JSON',
      ErrorCode.JSON_PARSE_ERROR,
      'fatal',
      error
    )
  }
}
```

### 3.3 GitHub API エラー

```typescript
async function handleGitHubAPICall<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation()
  } catch (error: any) {
    // レート制限
    if (
      error.status === 403 &&
      error.response?.headers?.['x-ratelimit-remaining'] === '0'
    ) {
      const resetTime = new Date(
        parseInt(error.response.headers['x-ratelimit-reset']) * 1000
      )

      throw new GitHubAPIError(
        `GitHub API rate limit exceeded. Resets at ${resetTime.toISOString()}`,
        ErrorCode.API_RATE_LIMIT_EXCEEDED,
        403,
        error.response
      )
    }

    // 認証エラー
    if (error.status === 401) {
      throw new GitHubAPIError(
        'GitHub authentication failed. Check GITHUB_TOKEN',
        ErrorCode.API_AUTHENTICATION_FAILED,
        401
      )
    }

    // 権限エラー
    if (error.status === 403) {
      throw new GitHubAPIError(
        `Insufficient permissions for ${context}`,
        ErrorCode.API_PERMISSION_DENIED,
        403,
        error.response
      )
    }

    // リソース不在
    if (error.status === 404) {
      throw new GitHubAPIError(
        `GitHub resource not found: ${context}`,
        ErrorCode.API_NOT_FOUND,
        404
      )
    }

    // サーバーエラー
    if (error.status >= 500) {
      throw new GitHubAPIError(
        `GitHub server error: ${error.message}`,
        ErrorCode.API_SERVER_ERROR,
        error.status,
        error.response
      )
    }

    // その他のAPIエラー
    throw new GitHubAPIError(
      `GitHub API error in ${context}: ${error.message}`,
      ErrorCode.API_SERVER_ERROR,
      error.status,
      error
    )
  }
}
```

## 4. エラーリカバリー戦略

### 4.1 リトライメカニズム

```typescript
interface RetryOptions {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  retryableErrors: ErrorCode[]
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // リトライ不可能なエラー
      if (error instanceof BundleStatsError) {
        if (!options.retryableErrors.includes(error.code)) {
          throw error
        }
      }

      // 最終試行
      if (attempt === options.maxAttempts) {
        throw error
      }

      // 遅延計算（指数バックオフ）
      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt - 1),
        options.maxDelay
      )

      core.warning(
        `Attempt ${attempt} failed: ${lastError.message}. ` +
          `Retrying in ${delay}ms...`
      )

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// 使用例
const result = await withRetry(() => postComment(body), {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableErrors: [
    ErrorCode.API_RATE_LIMIT_EXCEEDED,
    ErrorCode.API_SERVER_ERROR
  ]
})
```

### 4.2 フォールバック処理

```typescript
class ErrorRecovery {
  static async recoverWithFallback<T>(
    primary: () => Promise<T>,
    fallbacks: Array<() => Promise<T>>,
    logContext: string
  ): Promise<T> {
    try {
      return await primary()
    } catch (primaryError) {
      core.warning(`Primary operation failed: ${primaryError}`)

      for (const [index, fallback] of fallbacks.entries()) {
        try {
          core.info(`Trying fallback ${index + 1} for ${logContext}`)
          return await fallback()
        } catch (fallbackError) {
          core.warning(`Fallback ${index + 1} failed: ${fallbackError}`)
        }
      }

      throw new BundleStatsError(
        `All attempts failed for ${logContext}`,
        ErrorCode.ANALYSIS_FAILED,
        'error',
        { primary: primaryError }
      )
    }
  }
}

// 使用例：コメント投稿のフォールバック
await ErrorRecovery.recoverWithFallback(
  // Primary: 完全なレポート
  () => postFullReport(analysis),
  [
    // Fallback 1: 簡易レポート
    () => postSummaryReport(analysis),
    // Fallback 2: エラー通知のみ
    () => postErrorNotification('Analysis completed with errors')
  ],
  'comment posting'
)
```

## 5. エラーロギングとモニタリング

### 5.1 構造化ログ出力

```typescript
class ErrorLogger {
  static log(error: Error, context?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString()
    const isDebug = core.isDebug()

    // 基本エラー情報
    const errorInfo = {
      timestamp,
      name: error.name,
      message: error.message,
      ...(error instanceof BundleStatsError && {
        code: error.code,
        level: error.level,
        details: error.details
      }),
      ...context
    }

    // ログレベルに応じた出力
    if (error instanceof BundleStatsError) {
      switch (error.level) {
        case 'fatal':
          core.error(JSON.stringify(errorInfo))
          break
        case 'error':
          core.error(error.message)
          if (isDebug) {
            core.debug(JSON.stringify(errorInfo))
          }
          break
        case 'warning':
          core.warning(error.message)
          break
        case 'info':
          core.info(error.message)
          break
      }
    } else {
      core.error(JSON.stringify(errorInfo))
    }

    // スタックトレース（デバッグモード）
    if (isDebug && error.stack) {
      core.debug(`Stack trace:\n${error.stack}`)
    }
  }
}
```

### 5.2 エラー集約

```typescript
class ErrorCollector {
  private errors: Array<{ error: Error; context: unknown }> = []

  collect(error: Error, context?: unknown): void {
    this.errors.push({ error, context })
  }

  hasErrors(): boolean {
    return this.errors.length > 0
  }

  hasFatalErrors(): boolean {
    return this.errors.some(
      ({ error }) =>
        error instanceof BundleStatsError && error.level === 'fatal'
    )
  }

  report(): void {
    if (this.errors.length === 0) return

    core.startGroup('Error Summary')

    const summary = {
      total: this.errors.length,
      byLevel: this.groupByLevel(),
      byCode: this.groupByCode()
    }

    core.info(JSON.stringify(summary, null, 2))

    this.errors.forEach(({ error, context }, index) => {
      core.info(`Error ${index + 1}:`)
      ErrorLogger.log(error, context as Record<string, unknown>)
    })

    core.endGroup()
  }

  private groupByLevel(): Record<string, number> {
    // レベル別集計実装
  }

  private groupByCode(): Record<string, number> {
    // エラーコード別集計実装
  }
}
```

## 6. ユーザー向けエラーメッセージ

### 6.1 エラーメッセージフォーマット

```typescript
class UserErrorFormatter {
  static format(error: Error): string {
    if (error instanceof BundleStatsError) {
      switch (error.code) {
        case ErrorCode.FILE_NOT_FOUND:
          return (
            `📁 **File Not Found**\n\n` +
            `Could not find the stats file at: \`${error.details}\`\n\n` +
            `**Solution**: Make sure webpack-stats.json is generated before running this action.`
          )

        case ErrorCode.JSON_PARSE_ERROR:
          return (
            `🚫 **Invalid JSON Format**\n\n` +
            `The stats file contains invalid JSON.\n\n` +
            `**Solution**: Ensure webpack is configured to output valid JSON stats.`
          )

        case ErrorCode.API_RATE_LIMIT_EXCEEDED:
          return (
            `⏱️ **GitHub API Rate Limit**\n\n` +
            `API rate limit exceeded. Try again later.\n\n` +
            `**Solution**: Wait for rate limit reset or use a different token.`
          )

        default:
          return `❌ **Error**: ${error.message}`
      }
    }

    return `❌ **Unexpected Error**: ${error.message}`
  }
}
```

### 6.2 PRコメントでのエラー表示

```typescript
function formatErrorComment(error: Error): string {
  const userMessage = UserErrorFormatter.format(error)

  return `<!-- bundle-stats-action -->
## 📊 Bundle Size Report

${userMessage}

---
<details>
<summary>Error Details</summary>

\`\`\`
${error.stack || error.toString()}
\`\`\`

</details>

<sub>If this error persists, please [report an issue](https://github.com/owner/repo/issues).</sub>
`
}
```

## 7. エラー防止策

### 7.1 入力検証

```typescript
class InputValidator {
  static validateStatsPath(path: string): void {
    if (!path) {
      throw new ValidationError(
        'Stats path is required',
        ErrorCode.CONFIG_MISSING_REQUIRED,
        'stats-path',
        path
      )
    }

    if (!path.endsWith('.json')) {
      throw new ValidationError(
        'Stats file must be a JSON file',
        ErrorCode.CONFIG_INVALID_INPUT,
        'stats-path',
        path
      )
    }
  }

  static validateThreshold(value: string, field: string): number {
    const parsed = parseInt(value, 10)

    if (isNaN(parsed)) {
      throw new ValidationError(
        `${field} must be a valid number`,
        ErrorCode.CONFIG_INVALID_INPUT,
        field,
        value
      )
    }

    if (parsed < 0) {
      throw new ValidationError(
        `${field} must be non-negative`,
        ErrorCode.CONFIG_INVALID_INPUT,
        field,
        value
      )
    }

    return parsed
  }
}
```

### 7.2 実行前チェック

```typescript
async function preflightChecks(): Promise<void> {
  const errors = new ErrorCollector()

  // 環境チェック
  if (!process.env.GITHUB_TOKEN) {
    errors.collect(
      new BundleStatsError(
        'GITHUB_TOKEN is not set',
        ErrorCode.ENV_MISSING_TOKEN,
        'fatal'
      )
    )
  }

  // PRコンテキストチェック
  if (!github.context.payload.pull_request) {
    errors.collect(
      new BundleStatsError(
        'This action must run in a pull request context',
        ErrorCode.ENV_NOT_PR_CONTEXT,
        'fatal'
      )
    )
  }

  // 入力パラメータチェック
  try {
    const statsPath = core.getInput('stats-path', { required: true })
    InputValidator.validateStatsPath(statsPath)
  } catch (error) {
    errors.collect(error as Error)
  }

  // エラーがあれば報告して終了
  if (errors.hasErrors()) {
    errors.report()
    throw new BundleStatsError(
      'Preflight checks failed',
      ErrorCode.CONFIG_INVALID_INPUT,
      'fatal'
    )
  }
}
```

このエラーハンドリング設計により、予期しない状況でも適切に対処し、ユーザーに有用な情報を提供できます。
