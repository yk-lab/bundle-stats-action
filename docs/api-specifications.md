# Bundle Stats Action API仕様書

## 1. GitHub API 使用仕様

### 1.1 認証

```typescript
interface Authentication {
  token: string // GITHUB_TOKEN環境変数から取得
  permissions: {
    contents: 'read'
    issues: 'write'
    pull_requests: 'write'
  }
}
```

### 1.2 使用するAPIエンドポイント

#### 1.2.1 PRコメント一覧取得

```typescript
// GET /repos/{owner}/{repo}/issues/{issue_number}/comments
interface ListCommentsParams {
  owner: string
  repo: string
  issue_number: number
  per_page?: number // デフォルト: 100
  page?: number
}

interface CommentResponse {
  id: number
  body: string
  user: {
    login: string
    type: string
  }
  created_at: string
  updated_at: string
}
```

#### 1.2.2 コメント投稿

```typescript
// POST /repos/{owner}/{repo}/issues/{issue_number}/comments
interface CreateCommentParams {
  owner: string
  repo: string
  issue_number: number
  body: string
}
```

#### 1.2.3 コメント更新

```typescript
// PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}
interface UpdateCommentParams {
  owner: string
  repo: string
  comment_id: number
  body: string
}
```

### 1.3 コメント識別戦略

```typescript
// コメント本文の先頭に識別子を埋め込む
const COMMENT_IDENTIFIER = '<!-- bundle-stats-action -->'

// 識別子を含むコメントの検索
function findExistingComment(
  comments: CommentResponse[]
): CommentResponse | undefined {
  return comments.find(
    (comment) =>
      comment.body.startsWith(COMMENT_IDENTIFIER) && comment.user.type === 'Bot'
  )
}
```

### 1.4 レート制限対策

```typescript
interface RateLimitStrategy {
  // リトライ設定
  maxRetries: 3;
  retryDelay: number; // ミリ秒

  // レート制限ヘッダーの確認
  checkHeaders(response: Response): {
    remaining: number;
    reset: Date;
    limit: number;
  };

  // 指数バックオフ
  calculateDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  };
}

// 実装例
async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      if (isRateLimitError(error)) {
        const delay = calculateDelay(attempt);
        core.warning(`Rate limited. Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }

  throw new Error('Max retries exceeded');
}
```

## 2. エラーレスポンス処理

### 2.1 GitHub APIエラー

```typescript
interface GitHubError {
  status: number
  message: string
  documentation_url?: string
  errors?: Array<{
    resource: string
    field: string
    code: string
  }>
}

// エラーハンドリング
function handleGitHubError(error: unknown): never {
  if (isGitHubError(error)) {
    switch (error.status) {
      case 401:
        throw new Error('Authentication failed. Check GITHUB_TOKEN')
      case 403:
        throw new Error('Permission denied. Token needs write access')
      case 404:
        throw new Error('Resource not found. Check repository and PR number')
      case 422:
        throw new Error('Invalid request. Check comment format')
      default:
        throw new Error(`GitHub API error: ${error.message}`)
    }
  }
  throw error
}
```

### 2.2 権限チェック

```typescript
async function checkPermissions(octokit: Octokit): Promise<void> {
  try {
    // リポジトリへのアクセス確認
    const { data: repo } = await octokit.rest.repos.get({
      owner: context.repo.owner,
      repo: context.repo.repo
    })

    // PRへの書き込み権限確認
    if (!repo.permissions?.push) {
      throw new Error('Token lacks write permissions')
    }
  } catch (error) {
    core.error('Permission check failed')
    throw error
  }
}
```

## 3. コンテキスト情報の取得

### 3.1 GitHub Actionsコンテキスト

```typescript
interface ActionContext {
  // リポジトリ情報
  repository: {
    owner: string
    repo: string
  }

  // PR情報
  pullRequest?: {
    number: number
    head: {
      ref: string
      sha: string
    }
    base: {
      ref: string
      sha: string
    }
  }

  // 実行情報
  runId: number
  runNumber: number
  actor: string
  eventName: string
}

// コンテキスト取得
function getActionContext(): ActionContext {
  const context = github.context

  if (!context.payload.pull_request) {
    throw new Error('This action must be run on pull_request events')
  }

  return {
    repository: {
      owner: context.repo.owner,
      repo: context.repo.repo
    },
    pullRequest: {
      number: context.payload.pull_request.number,
      head: context.payload.pull_request.head,
      base: context.payload.pull_request.base
    },
    runId: context.runId,
    runNumber: context.runNumber,
    actor: context.actor,
    eventName: context.eventName
  }
}
```

## 4. Webhook イベント処理

### 4.1 対応イベント

```yaml
# action.ymlでの設定
on:
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request_target:
    types: [opened, synchronize, reopened]
```

### 4.2 イベントペイロード

```typescript
interface PullRequestEvent {
  action: 'opened' | 'synchronize' | 'reopened' | 'closed'
  number: number
  pull_request: {
    id: number
    number: number
    state: 'open' | 'closed'
    title: string
    body: string
    head: {
      ref: string
      sha: string
      repo: Repository
    }
    base: {
      ref: string
      sha: string
      repo: Repository
    }
  }
  repository: Repository
  sender: User
}
```

## 5. セキュリティ考慮事項

### 5.1 トークンスコープ

最小権限の原則：

```yaml
permissions:
  contents: read # ファイル読み取り
  pull-requests: write # コメント投稿
  issues: write # Issue APIアクセス（PR含む）
```

### 5.2 フォークからのPR

```typescript
// フォークからのPRの検出
function isFromFork(context: ActionContext): boolean {
  const pr = context.pullRequest
  if (!pr) return false

  return pr.head.repo.full_name !== pr.base.repo.full_name
}

// フォークの場合の制限
if (isFromFork(context)) {
  core.warning('Running on fork PR with limited permissions')
  // read-onlyモードで実行
}
```

## 6. 並行実行制御

### 6.1 同時実行の防止

```typescript
class CommentLock {
  private static locks = new Map<string, Promise<void>>()

  static async acquire(key: string): Promise<() => void> {
    const existing = this.locks.get(key)
    if (existing) {
      await existing
    }

    let release: () => void
    const promise = new Promise<void>((resolve) => {
      release = resolve
    })

    this.locks.set(key, promise)

    return () => {
      this.locks.delete(key)
      release()
    }
  }
}

// 使用例
async function updateComment(prNumber: number, body: string): Promise<void> {
  const release = await CommentLock.acquire(`pr-${prNumber}`)

  try {
    // コメント更新処理
    await performUpdate(body)
  } finally {
    release()
  }
}
```

## 7. API呼び出しの最適化

### 7.1 バッチ処理

```typescript
// 複数のAPI呼び出しを並行実行
async function gatherPRInfo(prNumber: number): Promise<PRInfo> {
  const [comments, files, checks] = await Promise.all([
    octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber
    }),
    octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber
    }),
    octokit.rest.checks.listForRef({
      owner,
      repo,
      ref: headSha
    })
  ])

  return {
    comments: comments.data,
    files: files.data,
    checks: checks.data
  }
}
```

### 7.2 キャッシュ戦略

```typescript
class APICache {
  private cache = new Map<string, CacheEntry>()
  private ttl = 60000 // 1分

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key)

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data as T
    }

    const data = await fetcher()
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })

    return data
  }
}
```

## 8. 診断とモニタリング

### 8.1 APIコールのトレース

```typescript
interface APICallTrace {
  endpoint: string
  method: string
  duration: number
  status: number
  rateLimitRemaining?: number
}

function traceAPICall(trace: APICallTrace): void {
  core.debug(
    JSON.stringify({
      type: 'api_call',
      ...trace,
      timestamp: new Date().toISOString()
    })
  )
}
```

### 8.2 パフォーマンスメトリクス

```typescript
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()

  measure<T>(name: string, operation: () => T): T {
    const start = performance.now()
    try {
      return operation()
    } finally {
      const duration = performance.now() - start
      this.record(name, duration)
    }
  }

  private record(name: string, duration: number): void {
    const values = this.metrics.get(name) || []
    values.push(duration)
    this.metrics.set(name, values)
  }

  report(): void {
    for (const [name, values] of this.metrics) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      core.info(`Performance: ${name} avg=${avg.toFixed(2)}ms`)
    }
  }
}
```

このAPI仕様書により、GitHub APIとの安全で効率的な連携が可能になります。
