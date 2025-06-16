# Bundle Stats Action

[![GitHub Super-Linter](https://github.com/yk-lab/bundle-stats-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/yk-lab/bundle-stats-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/yk-lab/bundle-stats-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/yk-lab/bundle-stats-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/yk-lab/bundle-stats-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/yk-lab/bundle-stats-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

[English](./README.md) | 日本語

webpack のバンドルサイズを解析し、プルリクエストにサイズレポートを投稿する GitHub
Action です。外部サービスを使わずに、中小規模プロジェクトでコスト効率的にバンドルサイズを監視できます。

## 📚 ドキュメント

- [アーキテクチャ概要](./docs/architecture.md) - システム設計とモジュール構造
- [データ構造](./docs/data-structures.md) - 入出力フォーマットと内部データモデル
- [API仕様](./docs/api-specifications.md) - GitHub API統合の詳細
- [エラーハンドリング](./docs/error-handling.md) - エラータイプとリカバリー戦略
- [テスト計画](./docs/test-plan.md) - テスト戦略とカバレッジ目標
- [実装ガイド](./docs/implementation-guide.md) - コーディング規約とベストプラクティス
- [開発環境セットアップ](./docs/development-setup.md) - ローカル開発環境ガイド
- [デプロイメントガイド](./docs/deployment-guide.md) - リリースプロセスとバージョニング

## 🚀 機能

- 📊 webpack-stats.json を解析してバンドルサイズをレポート
- 💬 PRコメントにサイズ情報を投稿・更新
- 🚨 サイズ閾値を超えた場合にCIを失敗させる
- 📈 個別ファイルサイズと合計バンドルサイズの両方を追跡
- 🎯 設定可能なサイズ閾値
- 📦 読みやすさのための折りたたみ可能なファイルリスト
- 🏷️ ステータス用のSVGバッジ生成
- ⚡ 高速で軽量

## 📋 必要要件

- Node.js 20.19.x
- stats JSONを出力するように設定されたwebpack
- PR書き込み権限を持つGitHubトークン

## 🔧 セットアップ

### webpack設定

webpack-stats.jsonを生成するようにwebpackを設定します：

```javascript
// webpack.config.js
module.exports = {
  // ... その他の設定
  stats: {
    all: false,
    assets: true,
    hash: true,
    timings: true,
    publicPath: true,
    outputPath: true
  }
}
```

または、CLIオプションを使用：

```bash
webpack --json > webpack-stats.json
```

## 📖 使い方

### 基本設定

```yaml
name: Bundle Size Check
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  check-bundle:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: プロジェクトのビルド
        run: |
          npm install
          npm run build

      - name: バンドルサイズチェック
        uses: yk-lab/bundle-stats-action@v1
        with:
          stats-path: 'dist/webpack-stats.json'
          bundle-size-threshold: 2097152 # ファイルごとに2MB
          total-size-threshold: 10485760 # 合計10MB
          fail-on-threshold-exceed: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 入力パラメータ

| 名前                       | 型      | デフォルト           | 説明                                           |
| -------------------------- | ------- | -------------------- | ---------------------------------------------- |
| `stats-path`               | string  | `webpack-stats.json` | webpack stats JSONファイルのパス               |
| `bundle-size-threshold`    | number  | `2097152` (2MB)      | 個別ファイルサイズの閾値（バイト単位）         |
| `total-size-threshold`     | number  | `10485760` (10MB)    | 合計バンドルサイズの閾値（バイト単位）         |
| `fail-on-threshold-exceed` | boolean | `true`               | 閾値を超えた場合にCIジョブを失敗させるかどうか |

### 出力パラメータ

| 名前           | 型      | 説明                                      |
| -------------- | ------- | ----------------------------------------- |
| `comment-body` | string  | 投稿/更新されたコメントのMarkdown内容     |
| `exceeded`     | boolean | いずれかの閾値を超えたかどうか            |
| `badge-svg`    | string  | バンドルサイズステータス用のSVGバッジ内容 |

### 高度な設定例

#### カスタムwebpack設定

```yaml
- name: カスタムwebpackビルド
  run: |
    npx webpack --config webpack.prod.js --json > dist/stats.json

- name: バンドルサイズチェック
  uses: yk-lab/bundle-stats-action@v1
  with:
    stats-path: 'dist/stats.json'
    bundle-size-threshold: 5242880 # 5MB
```

#### 複数のバンドルチェック

```yaml
- name: メインバンドルチェック
  uses: yk-lab/bundle-stats-action@v1
  with:
    stats-path: 'dist/main-stats.json'
    bundle-size-threshold: 2097152

- name: ベンダーバンドルチェック
  uses: yk-lab/bundle-stats-action@v1
  with:
    stats-path: 'dist/vendor-stats.json'
    bundle-size-threshold: 5242880 # ベンダーには大きめの閾値
```

## 📊 PRコメントの例

アクションは以下のようなコメントをPRに投稿します：

```markdown
## 📊 Bundle Size Report

**Total Size**: 5.2 MB ⚠️ (threshold: 10 MB)

<details>
<summary>📦 Bundle Details (showing top 10 of 25 files)</summary>

| File       | Size   | Status           |
| ---------- | ------ | ---------------- |
| vendor.js  | 2.3 MB | ❌ Exceeds limit |
| main.js    | 1.5 MB | ✅               |
| styles.css | 800 KB | ✅               |
| ...        | ...    | ...              |

</details>

### ⚠️ Threshold Violations

- **2 files** exceed individual size limit (2 MB)
- Total bundle size is within limit
```

## 🛠️ 開発

ローカル開発環境のセットアップ：

```bash
# リポジトリのクローン
git clone https://github.com/yk-lab/bundle-stats-action.git
cd bundle-stats-action

# 依存関係のインストール（pnpm必須）
pnpm install

# テストの実行
pnpm test

# ビルド
pnpm run package
```

詳細は[開発環境セットアップガイド](./docs/development-setup.md)を参照してください。

## 📄 ライセンス

MIT © yk-lab

## 🤝 コントリビューション

プルリクエストを歓迎します！大きな変更の場合は、まずissueを開いて変更内容について議論してください。

詳細は[コントリビューションガイドライン](./CONTRIBUTING.md)を参照してください。

## 🐛 バグ報告

バグを見つけた場合は、[GitHub Issues](https://github.com/yk-lab/bundle-stats-action/issues)で報告してください。

## 📮 サポート

- 📖 [ドキュメント](./docs/)
- 💬
  [GitHub Discussions](https://github.com/yk-lab/bundle-stats-action/discussions)
- 🐛 [Issue Tracker](https://github.com/yk-lab/bundle-stats-action/issues)
