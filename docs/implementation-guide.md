# Bundle Stats Action 実装ガイドライン

## 1. コーディング規約

### 1.1 TypeScript

- **厳格な型定義**: `any`型の使用禁止、`unknown`を推奨
- **インターフェース優先**: 型エイリアスよりインターフェースを使用
- **null安全**: オプショナルチェイニング（`?.`）とnull合体演算子（`??`）を活用
- **const assertion**: 定数配列やオブジェクトには`as const`を使用

```typescript
// Good
interface Config {
  threshold: number
  path: string
}

const SIZES = ['B', 'KB', 'MB', 'GB'] as const
type SizeUnit = (typeof SIZES)[number]

// Bad
type Config = {
  threshold: any
  path: string
}
```

### 1.2 エラーハンドリング

- **早期リターン**: ネストを避けるため、エラーケースは早期にリターン
- **エラーの分類**: Fatal/Warning/Infoの3段階
- **カスタムエラー**: 独自のエラークラスを定義

```typescript
// Good
export class BundleStatsError extends Error {
  constructor(
    message: string,
    public code: string,
    public level: 'fatal' | 'warning' | 'info'
  ) {
    super(message)
    this.name = 'BundleStatsError'
  }
}

// Usage
if (!fs.existsSync(statsPath)) {
  throw new BundleStatsError(
    `File not found: ${statsPath}`,
    'FILE_NOT_FOUND',
    'fatal'
  )
}
```

### 1.3 非同期処理

- **async/await優先**: Promiseチェーンより可読性が高い
- **並行処理**: 独立した処理は`Promise.all`で並行実行
- **エラー境界**: try-catchで適切にエラーをキャッチ

```typescript
// Good
async function analyzeBundle(): Promise<AnalysisResult> {
  try {
    const [stats, config] = await Promise.all([readStatsFile(), loadConfig()])
    return processStats(stats, config)
  } catch (error) {
    logger.error('Failed to analyze bundle', error)
    throw error
  }
}
```

## 2. モジュール設計原則

### 2.1 単一責任の原則

各モジュールは1つの明確な責任を持つ：

```typescript
// Good - 単一責任
export class StatsParser {
  parse(content: string): WebpackStats {
    // JSONパースのみに専念
  }
}

export class BundleAnalyzer {
  analyze(stats: WebpackStats, config: Config): AnalysisResult {
    // 分析のみに専念
  }
}

// Bad - 複数責任
export class StatsHandler {
  parseAndAnalyze(filePath: string): AnalysisResult {
    // パースと分析の両方を担当
  }
}
```

### 2.2 依存性注入

テスタビリティのため、外部依存は注入する：

```typescript
// Good
export class CommentManager {
  constructor(
    private octokit: Octokit,
    private context: Context
  ) {}

  async postComment(body: string): Promise<void> {
    // octokitを使用
  }
}

// Bad
export class CommentManager {
  private octokit = github.getOctokit(token) // 直接生成
}
```

### 2.3 純粋関数の活用

副作用のない純粋関数を優先：

```typescript
// Good - 純粋関数
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Bad - 副作用あり
let totalSize = 0
export function addToTotal(bytes: number): string {
  totalSize += bytes // 外部状態を変更
  return formatFileSize(totalSize)
}
```

## 3. テスト実装方針

### 3.1 テストファイル構成

```plain
__tests__/
├── unit/                    # 単体テスト
│   ├── parser/
│   │   └── stats-parser.test.ts
│   ├── analyzer/
│   │   └── bundle-analyzer.test.ts
│   └── utils/
│       └── file-size.test.ts
├── integration/             # 統合テスト
│   └── main.test.ts
└── fixtures/               # テストデータ
    ├── webpack-stats-valid.json
    ├── webpack-stats-large.json
    └── webpack-stats-invalid.json
```

### 3.2 テストパターン

**Arrange-Act-Assert**パターンを使用：

```typescript
describe('BundleAnalyzer', () => {
  describe('analyze', () => {
    it('should detect files exceeding threshold', () => {
      // Arrange
      const stats = createMockStats([
        { name: 'large.js', size: 3 * 1024 * 1024 }, // 3MB
        { name: 'small.js', size: 1 * 1024 * 1024 } // 1MB
      ])
      const config = { bundleSizeThreshold: 2 * 1024 * 1024 } // 2MB
      const analyzer = new BundleAnalyzer()

      // Act
      const result = analyzer.analyze(stats, config)

      // Assert
      expect(result.threshold.individualExceeded).toContain('large.js')
      expect(result.threshold.individualExceeded).not.toContain('small.js')
    })
  })
})
```

### 3.3 モック戦略

外部依存は適切にモック：

```typescript
// GitHub APIのモック
const mockOctokit = {
  rest: {
    issues: {
      listComments: jest.fn().mockResolvedValue({ data: [] }),
      createComment: jest.fn().mockResolvedValue({ data: { id: 123 } }),
      updateComment: jest.fn().mockResolvedValue({ data: { id: 123 } })
    }
  }
}

// ファイルシステムのモック
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockImplementation((path) => {
    if (path === 'valid.json') return JSON.stringify(validStats)
    throw new Error('File not found')
  })
}))
```

## 4. パフォーマンス最適化

### 4.1 メモリ効率

- 大きなファイルは必要な部分のみ保持
- 不要なオブジェクトは早期に解放

```typescript
// Good
function processStats(stats: WebpackStats): AnalyzedAsset[] {
  return stats.assets
    .filter((asset) => !asset.name.endsWith('.map')) // ソースマップ除外
    .map((asset) => ({
      name: asset.name,
      size: asset.size,
      sizeText: formatFileSize(asset.size),
      exceeded: false
    }))
}
```

### 4.2 計算の最適化

- 重い計算はキャッシュ
- ループ内での計算を最小化

```typescript
// Good
const sizeCache = new Map<number, string>()

export function formatFileSize(bytes: number): string {
  if (sizeCache.has(bytes)) {
    return sizeCache.get(bytes)!
  }

  const formatted = calculateFormattedSize(bytes)
  sizeCache.set(bytes, formatted)
  return formatted
}
```

## 5. ロギング指針

### 5.1 ログレベル

```typescript
// デバッグ情報（ACTIONS_STEP_DEBUG=trueの時のみ）
core.debug(`Processing ${assets.length} assets`)

// 情報ログ
core.info(`Bundle analysis completed: ${result.summary.fileCount} files`)

// 警告ログ
core.warning(`Large bundle detected: ${result.summary.totalSizeText}`)

// エラーログ
core.error(`Failed to parse webpack-stats.json: ${error.message}`)
```

### 5.2 構造化ログ

```typescript
// Good - 構造化された情報
core.info(
  JSON.stringify({
    event: 'analysis_complete',
    fileCount: result.summary.fileCount,
    totalSize: result.summary.totalSize,
    exceeded: result.threshold.anyExceeded
  })
)
```

## 6. セキュリティ考慮事項

### 6.1 入力検証

```typescript
// ファイルパスの検証
function validatePath(path: string): void {
  if (path.includes('..')) {
    throw new Error('Path traversal detected')
  }
  if (!path.endsWith('.json')) {
    throw new Error('Invalid file extension')
  }
}
```

### 6.2 出力のサニタイズ

```typescript
// Markdownエスケープ
function escapeMarkdown(text: string): string {
  return text
    .replace(/\|/g, '\\|')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```

## 7. CI/CD統合

### 7.1 ローカルテスト

```bash
# 開発時のテストコマンド
npm test                    # 単体テスト
npm run test:integration    # 統合テスト
npm run test:coverage       # カバレッジ付き

# アクションのローカル実行
npm run local-action
```

### 7.2 自動チェック

PRマージ前に必須：

- [ ] 型チェック通過
- [ ] リント通過
- [ ] テスト全通過
- [ ] カバレッジ80%以上
- [ ] dist/更新済み

## 8. デバッグ支援

### 8.1 デバッグモード

```typescript
const isDebug =
  core.getBooleanInput('debug') || process.env.ACTIONS_STEP_DEBUG === 'true'

if (isDebug) {
  core.debug(`Raw stats: ${JSON.stringify(stats, null, 2)}`)
}
```

### 8.2 エラートレース

```typescript
try {
  await processBundle()
} catch (error) {
  if (error instanceof Error) {
    core.error(`Error: ${error.message}`)
    if (isDebug && error.stack) {
      core.debug(`Stack trace:\n${error.stack}`)
    }
  }
  throw error
}
```

## 9. ドキュメント更新

コード変更時は以下も更新：

- [ ] JSDocコメント
- [ ] README.md（使用方法）
- [ ] CHANGELOG.md（変更履歴）
- [ ] action.yml（パラメータ変更時）

これらのガイドラインに従うことで、保守性が高く、信頼性のあるGitHub
Actionを実装できます。
