# Bundle Stats Action デプロイメントガイド

## 1. リリースプロセス

### 1.1 リリース前チェックリスト

```markdown
- [ ] すべてのテストが通過している
- [ ] コードカバレッジが基準値（85%）を満たしている
- [ ] ESLintエラーがない
- [ ] TypeScriptコンパイルエラーがない
- [ ] package.jsonのバージョンが更新されている
- [ ] CHANGELOGが更新されている
- [ ] READMEが最新の仕様を反映している
- [ ] dist/ディレクトリが最新のビルドで更新されている
- [ ] action.ymlの変更がある場合、後方互換性を確認
```

### 1.2 セマンティックバージョニング

| 変更タイプ | バージョン | 例            | 説明                               |
| ---------- | ---------- | ------------- | ---------------------------------- |
| Major      | X.0.0      | 1.0.0 → 2.0.0 | 破壊的変更（入力パラメータ変更等） |
| Minor      | x.Y.0      | 1.0.0 → 1.1.0 | 新機能追加（後方互換性あり）       |
| Patch      | x.y.Z      | 1.0.0 → 1.0.1 | バグ修正、軽微な改善               |

### 1.3 リリース手順

```bash
# 1. 最新のmainブランチを取得
git checkout main
git pull origin main

# 2. リリースブランチ作成
git checkout -b release/v1.2.0

# 3. バージョン更新
npm version minor  # or major/patch

# 4. ビルド実行
npm run all

# 5. 変更をコミット
git add -A
git commit -m "chore: prepare release v1.2.0"

# 6. プッシュしてPR作成
git push origin release/v1.2.0

# 7. PR承認後、mainにマージ

# 8. リリーススクリプト実行
./script/release
```

## 2. ビルドプロセス

### 2.1 ビルド設定

```typescript
// rollup.config.ts
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { terser } from 'rollup-plugin-terser'
import license from 'rollup-plugin-license'

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
    sourcemap: true,
    exports: 'named'
  },
  external: [
    // Node.js組み込みモジュール
    'fs',
    'path',
    'os',
    'crypto',
    'util'
    // 除外する必要のないパッケージ（バンドルに含める）
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      noEmitOnError: true
    }),
    nodeResolve({
      preferBuiltins: true
    }),
    commonjs(),
    terser({
      compress: {
        drop_console: false, // アクションではconsole出力を保持
        drop_debugger: true
      },
      mangle: {
        keep_classnames: true,
        keep_fnames: true
      }
    }),
    license({
      banner: `
        Bundle Stats Action v<%= pkg.version %>
        Copyright (c) <%= moment().format('YYYY') %> <%= pkg.author %>
        Licensed under <%= pkg.license %>
      `
    })
  ]
}
```

### 2.2 ビルド最適化

```json
// package.json scripts
{
  "scripts": {
    "build:analyze": "rollup -c --environment ANALYZE",
    "build:size": "npm run build && du -sh dist/",
    "build:validate": "node scripts/validate-build.js"
  }
}
```

```javascript
// scripts/validate-build.js
const fs = require('fs')
const path = require('path')

const MAX_SIZE = 50 * 1024 * 1024 // 50MB
const REQUIRED_FILES = ['dist/index.js', 'dist/index.js.map']

// サイズチェック
const stats = fs.statSync('dist/index.js')
if (stats.size > MAX_SIZE) {
  console.error(`Build size (${stats.size}) exceeds limit (${MAX_SIZE})`)
  process.exit(1)
}

// 必須ファイルチェック
for (const file of REQUIRED_FILES) {
  if (!fs.existsSync(file)) {
    console.error(`Required file missing: ${file}`)
    process.exit(1)
  }
}

console.log('Build validation passed ✓')
```

## 3. GitHub Actionsワークフロー

### 3.1 自動リリースワークフロー

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: npm run test:coverage

      - name: Build
        run: npm run build

      - name: Validate build
        run: npm run build:validate

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
          files: |
            dist/**
            action.yml
            README.md
            LICENSE
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Update major version tag
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}
          MAJOR=${VERSION%%.*}
          git tag -fa "v${MAJOR}" -m "Update major version tag"
          git push origin "v${MAJOR}" --force
```

### 3.2 dist/チェックワークフロー

```yaml
# .github/workflows/check-dist.yml
name: Check dist/

on:
  push:
    branches: [main]
  pull_request:
    paths:
      - 'src/**'
      - 'package*.json'
      - 'tsconfig.json'
      - 'rollup.config.ts'

jobs:
  check-dist:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: .node-version

      - name: Install dependencies
        run: pnpm install

      - name: Rebuild dist/
        run: npm run build

      - name: Compare dist/
        id: diff
        run: |
          if [ -n "$(git status --porcelain dist/)" ]; then
            echo "::error::dist/ is out of date. Run 'npm run build' and commit changes"
            exit 1
          fi
```

## 4. アクションのパブリッシュ

### 4.1 GitHub Marketplace準備

```yaml
# action.yml のメタデータ
name: 'Bundle Stats PR Commenter'
description: 'Analyze webpack bundle stats and post size reports to PRs'
author: 'yk-lab'

branding:
  icon: 'package'
  color: 'blue'

inputs:
  stats-path:
    description: 'Path to webpack-stats.json file'
    required: false
    default: 'webpack-stats.json'
  # ... その他の入力

runs:
  using: 'node20' # or 'node22' when available
  main: 'dist/index.js'
```

### 4.2 Marketplace公開チェックリスト

```markdown
- [ ] action.ymlのname、description、authorが適切
- [ ] brandingアイコンと色が設定されている
- [ ] READMEに使用例が含まれている
- [ ] READMEにライセンス情報がある
- [ ] READMEに必要な権限が記載されている
- [ ] セキュリティポリシーが定義されている
- [ ] CODEOWNERSファイルが設定されている
```

## 5. バージョン管理戦略

### 5.1 ブランチ戦略

```plain
main (default)
├── develop
│   ├── feature/add-svg-badge
│   ├── feature/improve-performance
│   └── fix/threshold-calculation
├── release/v1.2.0
└── hotfix/critical-bug
```

### 5.2 タグ管理

```bash
# メジャーバージョンタグ（推奨）
v1  # 最新の v1.x.x を指す

# マイナーバージョンタグ
v1.2  # 最新の v1.2.x を指す

# フルバージョンタグ（不変）
v1.2.0  # 特定のリリース

# プレリリース
v1.2.0-beta.1
v1.2.0-rc.1
```

## 6. 後方互換性の維持

### 6.1 非推奨化プロセス

```typescript
// 入力パラメータの非推奨化例
const statsPath =
  core.getInput('stats-path') || core.getInput('webpack-stats-path') // 旧パラメータ

if (core.getInput('webpack-stats-path')) {
  core.warning(
    'Input "webpack-stats-path" is deprecated. ' +
      'Please use "stats-path" instead.'
  )
}
```

### 6.2 移行ガイド

````markdown
# v1 → v2 移行ガイド

## 破壊的変更

1. 入力パラメータ名の変更

   - `webpack-stats-path` → `stats-path`
   - `size-limit` → `bundle-size-threshold`

2. 出力パラメータの変更
   - `bundle-size` → `total-size`

## 移行手順

```yaml
# 旧設定 (v1)
- uses: yk-lab/bundle-stats-action@v1
  with:
    webpack-stats-path: 'dist/stats.json'
    size-limit: 2000000

# 新設定 (v2)
- uses: yk-lab/bundle-stats-action@v2
  with:
    stats-path: 'dist/stats.json'
    bundle-size-threshold: 2000000
```

## 7. モニタリングとメトリクス

### 7.1 使用状況追跡

```typescript
// 匿名の使用統計（オプトイン）
function reportUsageMetrics(config: Config): void {
  if (core.getBooleanInput('disable-telemetry')) {
    return
  }

  const metrics = {
    version: process.env.ACTION_VERSION,
    node_version: process.version,
    action_event: github.context.eventName,
    file_count: config.fileCount,
    total_size_mb: Math.round(config.totalSize / (1024 * 1024)),
    duration_ms: Date.now() - startTime
  }

  // 送信処理（非ブロッキング）
  sendMetrics(metrics).catch(() => {
    // 失敗しても無視
  })
}
```
````

### 7.2 エラー追跡

```yaml
# Sentryなどのエラー追跡サービス統合
- name: Setup Error Tracking
  if: github.event_name == 'schedule'
  env:
    SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
  run: |
    echo "Error tracking enabled for scheduled runs"
```

## 8. ロールバック手順

### 8.1 緊急ロールバック

```bash
# 1. 問題のあるバージョンを特定
git tag -l | grep v1.2

# 2. 前のバージョンにメジャータグを戻す
git checkout v1.1.5
git tag -fa v1 -m "Rollback to v1.1.5"
git push origin v1 --force

# 3. 問題のあるリリースをyankする（非推奨化）
# GitHub UIでリリースをプレリリースに変更
```

### 8.2 ホットフィックス

```bash
# 1. 安定版からホットフィックスブランチ作成
git checkout v1.1.5
git checkout -b hotfix/critical-issue

# 2. 修正を実施
# ... 修正作業 ...

# 3. バージョンをパッチアップ
npm version patch  # 1.1.6

# 4. リリース
git push origin hotfix/critical-issue
# PR作成 → マージ → タグ付け
```

## 9. 運用ベストプラクティス

### 9.1 リリース頻度

- **定期リリース**: 2週間ごと（機能追加）
- **パッチリリース**: 必要に応じて即座に
- **メジャーリリース**: 3-6ヶ月ごと（要計画）

### 9.2 コミュニケーション

```markdown
## リリースノートテンプレート

### 🎉 Bundle Stats Action v1.2.0

#### ✨ 新機能

- SVGバッジ生成機能を追加 (#123)
- 処理中表示に対応 (#124)

#### 🐛 バグ修正

- 大きなファイルでのメモリリーク修正 (#125)

#### 📝 ドキュメント

- 設定例を追加 (#126)

#### ⚠️ 非推奨

- `webpack-stats-path`パラメータは次のメジャーバージョンで削除予定

**Full Changelog**:
https://github.com/yk-lab/bundle-stats-action/compare/v1.1.0...v1.2.0
```

### 9.3 サポートポリシー

| バージョン | サポート状況   | 終了予定日 |
| ---------- | -------------- | ---------- |
| v2.x       | ✅ Active      | -          |
| v1.x       | 🔧 Maintenance | 2025-01-01 |
| v0.x       | ❌ EOL         | 2024-01-01 |

このデプロイメントガイドに従うことで、安全で予測可能なリリースプロセスを実現できます。
