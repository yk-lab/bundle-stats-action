# Bundle Stats Action テスト計画書

## 1. テスト戦略概要

### 1.1 テストピラミッド

```plain
         /\
        /  \  E2E Tests (5%)
       /----\
      /      \ Integration Tests (20%)
     /--------\
    /          \ Unit Tests (75%)
   /____________\
```

### 1.2 カバレッジ目標

- 全体: 85%以上
- 単体テスト: 90%以上
- 統合テスト: 70%以上
- クリティカルパス: 100%

## 2. 単体テスト

### 2.1 Stats Parser テスト

```typescript
// __tests__/unit/parser/stats-parser.test.ts

describe('StatsParser', () => {
  describe('parse', () => {
    // 正常系
    it('should parse valid webpack stats JSON', () => {
      const input = readFixture('webpack-stats-valid.json')
      const result = parser.parse(input)

      expect(result).toMatchObject({
        assets: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            size: expect.any(Number)
          })
        ])
      })
    })

    // 異常系
    it('should throw on invalid JSON', () => {
      const input = '{invalid json}'
      expect(() => parser.parse(input)).toThrow('Parse error')
    })

    it('should throw on missing assets array', () => {
      const input = '{"version": "5.0.0"}'
      expect(() => parser.parse(input)).toThrow('Invalid schema')
    })

    // エッジケース
    it('should handle empty assets array', () => {
      const input = '{"assets": []}'
      const result = parser.parse(input)
      expect(result.assets).toHaveLength(0)
    })

    it('should handle very large files', () => {
      const largeStats = createLargeStats(1000) // 1000アセット
      const result = parser.parse(JSON.stringify(largeStats))
      expect(result.assets).toHaveLength(1000)
    })
  })
})
```

### 2.2 Bundle Analyzer テスト

```typescript
// __tests__/unit/analyzer/bundle-analyzer.test.ts

describe('BundleAnalyzer', () => {
  let analyzer: BundleAnalyzer

  beforeEach(() => {
    analyzer = new BundleAnalyzer()
  })

  describe('analyze', () => {
    // 閾値判定
    it('should identify files exceeding individual threshold', () => {
      const stats = createStats([
        { name: 'large.js', size: 3 * MB },
        { name: 'medium.js', size: 1.5 * MB },
        { name: 'small.js', size: 500 * KB }
      ])

      const config = {
        bundleSizeThreshold: 2 * MB,
        totalSizeThreshold: 10 * MB
      }

      const result = analyzer.analyze(stats, config)

      expect(result.threshold.individualExceeded).toEqual(['large.js'])
      expect(result.threshold.totalExceeded).toBe(false)
    })

    it('should detect total size threshold exceeded', () => {
      const stats = createStats([
        { name: 'file1.js', size: 4 * MB },
        { name: 'file2.js', size: 4 * MB },
        { name: 'file3.js', size: 4 * MB }
      ])

      const config = {
        bundleSizeThreshold: 5 * MB,
        totalSizeThreshold: 10 * MB
      }

      const result = analyzer.analyze(stats, config)

      expect(result.threshold.totalExceeded).toBe(true)
      expect(result.summary.totalSize).toBe(12 * MB)
    })

    // 境界値テスト
    it('should handle exact threshold values', () => {
      const stats = createStats([{ name: 'exact.js', size: 2 * MB }])

      const config = { bundleSizeThreshold: 2 * MB }
      const result = analyzer.analyze(stats, config)

      expect(result.threshold.individualExceeded).toHaveLength(0)
    })

    // パフォーマンステスト
    it('should handle large number of assets efficiently', () => {
      const stats = createStats(
        Array.from({ length: 10000 }, (_, i) => ({
          name: `file${i}.js`,
          size: Math.random() * 5 * MB
        }))
      )

      const start = performance.now()
      const result = analyzer.analyze(stats, { bundleSizeThreshold: 2 * MB })
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100) // 100ms以内
      expect(result.assets).toHaveLength(10000)
    })
  })
})
```

### 2.3 Comment Formatter テスト

```typescript
// __tests__/unit/formatter/comment-formatter.test.ts

describe('CommentFormatter', () => {
  describe('format', () => {
    it('should generate valid markdown table', () => {
      const analysis = createAnalysisResult([
        {
          name: 'main.js',
          size: 1.5 * MB,
          sizeText: '1.50 MB',
          exceeded: false
        },
        {
          name: 'vendor.js',
          size: 2.5 * MB,
          sizeText: '2.50 MB',
          exceeded: true
        }
      ])

      const markdown = formatter.format(analysis)

      expect(markdown).toContain('| File | Size | Status |')
      expect(markdown).toContain('| main.js | 1.50 MB | ✅ |')
      expect(markdown).toContain('| vendor.js | 2.50 MB | ❌ Exceeds limit |')
    })

    it('should include collapsible section for long lists', () => {
      const analysis = createAnalysisResult(
        Array.from({ length: 30 }, (_, i) => ({
          name: `file${i}.js`,
          size: 1 * MB,
          sizeText: '1.00 MB',
          exceeded: false
        }))
      )

      const markdown = formatter.format(analysis, { maxItems: 20 })

      expect(markdown).toContain('<details>')
      expect(markdown).toContain('<summary>')
      expect(markdown).toContain('showing top 20 of 30 files')
    })

    it('should escape special markdown characters', () => {
      const analysis = createAnalysisResult([
        {
          name: 'file|with|pipes.js',
          size: 1 * MB,
          sizeText: '1.00 MB',
          exceeded: false
        }
      ])

      const markdown = formatter.format(analysis)

      expect(markdown).toContain('file\\|with\\|pipes.js')
    })

    it('should include processing state', () => {
      const markdown = formatter.formatProcessing()

      expect(markdown).toContain('⏳ **Analyzing bundle stats...**')
      expect(markdown).toContain('<!-- bundle-stats-action -->')
    })
  })
})
```

### 2.4 Utility Functions テスト

```typescript
// __tests__/unit/utils/file-size.test.ts

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [1, '1 B'],
    [1023, '1023 B'],
    [1024, '1.00 KB'],
    [1536, '1.50 KB'],
    [1048576, '1.00 MB'],
    [1572864, '1.50 MB'],
    [1073741824, '1.00 GB'],
    [1610612736, '1.50 GB']
  ])('should format %i bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected)
  })

  it('should handle negative values', () => {
    expect(formatFileSize(-1024)).toBe('-1.00 KB')
  })

  it('should handle Infinity', () => {
    expect(formatFileSize(Infinity)).toBe('∞')
  })
})
```

## 3. 統合テスト

### 3.1 メインフロー統合テスト

```typescript
// __tests__/integration/main.test.ts

describe('Main integration', () => {
  let mockOctokit: MockOctokit
  let mockCore: MockCore

  beforeEach(() => {
    mockOctokit = createMockOctokit()
    mockCore = createMockCore()

    // 環境変数設定
    process.env.GITHUB_TOKEN = 'test-token'
    process.env.GITHUB_REPOSITORY = 'owner/repo'
  })

  it('should complete full workflow for new PR', async () => {
    // Arrange
    mockInputs({
      'stats-path': '__fixtures__/webpack-stats-valid.json',
      'bundle-size-threshold': '2097152',
      'total-size-threshold': '10485760',
      'fail-on-threshold-exceed': 'true'
    })

    mockOctokit.issues.listComments.mockResolvedValue({ data: [] })
    mockOctokit.issues.createComment.mockResolvedValue({
      data: { id: 123, body: 'comment' }
    })

    // Act
    await run()

    // Assert
    expect(mockOctokit.issues.listComments).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: expect.any(Number)
    })

    expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: expect.any(Number),
      body: expect.stringContaining('Bundle Size Report')
    })

    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'comment-body',
      expect.any(String)
    )

    expect(mockCore.setFailed).not.toHaveBeenCalled()
  })

  it('should update existing comment', async () => {
    // Arrange
    const existingComment = {
      id: 456,
      body: '<!-- bundle-stats-action -->\nOld content'
    }

    mockOctokit.issues.listComments.mockResolvedValue({
      data: [existingComment]
    })

    mockOctokit.issues.updateComment.mockResolvedValue({
      data: { ...existingComment, body: 'Updated' }
    })

    // Act
    await run()

    // Assert
    expect(mockOctokit.issues.updateComment).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      comment_id: 456,
      body: expect.stringContaining('Bundle Size Report')
    })
  })

  it('should fail on threshold exceeded', async () => {
    // Arrange
    mockInputs({
      'stats-path': '__fixtures__/webpack-stats-large.json',
      'bundle-size-threshold': '1048576', // 1MB
      'fail-on-threshold-exceed': 'true'
    })

    // Act
    await run()

    // Assert
    expect(mockCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('threshold exceeded')
    )
  })
})
```

### 3.2 エラー処理統合テスト

```typescript
describe('Error handling integration', () => {
  it('should handle missing stats file gracefully', async () => {
    mockInputs({
      'stats-path': 'non-existent.json'
    })

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('File not found')
    )
  })

  it('should handle GitHub API errors', async () => {
    mockOctokit.issues.createComment.mockRejectedValue(
      new Error('API rate limit exceeded')
    )

    await run()

    expect(mockCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('rate limit')
    )
  })

  it('should handle malformed JSON', async () => {
    mockInputs({
      'stats-path': '__fixtures__/webpack-stats-invalid.json'
    })

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Parse error')
    )
  })
})
```

## 4. End-to-end テスト

### 4.1 実環境テスト

```typescript
// __tests__/e2e/real-github.test.ts
// 注: 実際のGitHub APIを使用するため、CI環境でのみ実行

describe('E2E GitHub integration', () => {
  const testRepo = process.env.TEST_REPO
  const testPR = process.env.TEST_PR_NUMBER

  beforeAll(() => {
    if (!testRepo || !testPR) {
      console.log('Skipping E2E tests - no test environment')
      return
    }
  })

  it('should post real comment to test PR', async () => {
    // 実際のPRにコメントを投稿
    const result = await runAction({
      repo: testRepo,
      pr: testPR,
      statsPath: '__fixtures__/webpack-stats-e2e.json'
    })

    expect(result.success).toBe(true)
    expect(result.commentId).toBeDefined()

    // クリーンアップ
    await deleteComment(result.commentId)
  })
})
```

## 5. パフォーマンステスト

### 5.1 負荷テスト

```typescript
describe('Performance tests', () => {
  it('should handle large stats file within time limit', async () => {
    const largeStats = generateLargeStats({
      assetCount: 1000,
      averageSize: 500 * KB
    })

    const start = Date.now()
    await processStats(largeStats)
    const duration = Date.now() - start

    expect(duration).toBeLessThan(5000) // 5秒以内
  })

  it('should not exceed memory limit', async () => {
    const initialMemory = process.memoryUsage().heapUsed

    await processStats(
      generateLargeStats({
        assetCount: 10000,
        averageSize: 1 * MB
      })
    )

    const memoryIncrease = process.memoryUsage().heapUsed - initialMemory
    expect(memoryIncrease).toBeLessThan(100 * MB) // 100MB以内
  })
})
```

## 6. テストデータ（Fixtures）

### 6.1 フィクスチャ構成

```plain
__fixtures__/
├── webpack-stats-valid.json      # 正常なstatsファイル
├── webpack-stats-large.json      # 大きなファイルを含む
├── webpack-stats-empty.json      # 空のassets配列
├── webpack-stats-invalid.json    # 不正なJSON
├── webpack-stats-complex.json    # 複雑な構造（chunks, modules含む）
├── webpack-stats-edge.json       # エッジケース
└── webpack-stats-e2e.json        # E2Eテスト用
```

### 6.2 テストデータ生成ヘルパー

```typescript
// test-helpers/data-generators.ts

export function createStats(assets: AssetInput[]): WebpackStats {
  return {
    version: '5.0.0',
    hash: 'abc123',
    time: Date.now(),
    assets: assets.map((a) => ({
      name: a.name,
      size: a.size,
      chunks: [],
      emitted: true
    }))
  }
}

export function createAnalysisResult(
  assets: AnalyzedAsset[],
  options: Partial<AnalysisResult> = {}
): AnalysisResult {
  const totalSize = assets.reduce((sum, a) => sum + a.size, 0)

  return {
    assets,
    summary: {
      totalSize,
      totalSizeText: formatFileSize(totalSize),
      fileCount: assets.length,
      exceededFileCount: assets.filter((a) => a.exceeded).length
    },
    threshold: {
      individualExceeded: assets.filter((a) => a.exceeded).map((a) => a.name),
      totalExceeded: options.totalExceeded || false,
      anyExceeded:
        assets.some((a) => a.exceeded) || options.totalExceeded || false
    },
    ...options
  }
}
```

## 7. モックとスタブ

### 7.1 GitHub API モック

```typescript
// test-helpers/mock-octokit.ts

export function createMockOctokit(): MockOctokit {
  return {
    rest: {
      issues: {
        listComments: jest.fn(),
        createComment: jest.fn(),
        updateComment: jest.fn()
      },
      pulls: {
        get: jest.fn(),
        listFiles: jest.fn()
      }
    }
  }
}
```

### 7.2 Actions Core モック

```typescript
// test-helpers/mock-core.ts

export function createMockCore(): MockCore {
  const inputs = new Map<string, string>()

  return {
    getInput: jest.fn((name) => inputs.get(name) || ''),
    getBooleanInput: jest.fn((name) => inputs.get(name) === 'true'),
    setOutput: jest.fn(),
    setFailed: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    // Helper to set inputs
    __setInputs: (newInputs: Record<string, string>) => {
      inputs.clear()
      Object.entries(newInputs).forEach(([k, v]) => inputs.set(k, v))
    }
  }
}
```

## 8. テスト実行とレポート

### 8.1 テストコマンド

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest __tests__/unit",
    "test:integration": "jest __tests__/integration",
    "test:e2e": "jest __tests__/e2e",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand"
  }
}
```

### 8.2 カバレッジレポート設定

```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/analyzer/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  coverageReporters: ['text', 'lcov', 'html']
}
```

## 9. CI/CD テスト統合

### 9.1 GitHub Actions ワークフロー

```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 22.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

このテスト計画により、高品質で信頼性の高いGitHub Actionを実現します。
