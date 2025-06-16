# Bundle Stats Action ローカルテスト手順

## 1. セットアップ

### 1.1 依存関係のインストール

```bash
# pnpmがインストールされていない場合
npm install -g pnpm

# 依存関係をインストール
pnpm install
```

### 1.2 環境変数の設定

`.env.local`ファイルを作成:

```bash
# GitHubトークンの設定（PRコメント投稿権限が必要）
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxx

# テスト用リポジトリとPR番号
GITHUB_REPOSITORY=owner/repo
GITHUB_EVENT_NAME=pull_request
GITHUB_PR_NUMBER=123
```

## 2. ローカルテスト

### 2.1 テスト用webpack-stats.jsonの作成

```bash
# テスト用のstatsファイルを作成
cat > webpack-stats.json << 'EOF'
{
  "version": "5.89.0",
  "hash": "abc123",
  "time": 5432,
  "builtAt": 1234567890000,
  "publicPath": "/",
  "assets": [
    {
      "name": "main.js",
      "size": 1548288,
      "chunks": ["main"],
      "emitted": true
    },
    {
      "name": "vendor.js",
      "size": 3145728,
      "chunks": ["vendor"],
      "emitted": true
    },
    {
      "name": "styles.css",
      "size": 524288,
      "chunks": ["main"],
      "emitted": true
    }
  ]
}
EOF
```

### 2.2 ローカルアクション実行

```bash
# @github/local-actionを使用して実行
npm run local-action

# カスタム設定で実行
cat > .env.test << 'EOF'
INPUT_STATS-PATH=webpack-stats.json
INPUT_BUNDLE-SIZE-THRESHOLD=2097152
INPUT_TOTAL-SIZE-THRESHOLD=10485760
INPUT_FAIL-ON-THRESHOLD-EXCEED=true
GITHUB_TOKEN=your_token_here
GITHUB_REPOSITORY=owner/repo
GITHUB_EVENT_NAME=pull_request
EOF

npx @github/local-action . src/main.ts .env.test
```

### 2.3 単体テストの実行

```bash
# すべてのテストを実行
npm test

# カバレッジ付きで実行
npm run test -- --coverage

# 特定のテストファイルのみ実行
npm test -- __tests__/unit/analyzer/bundle-analyzer.test.ts

# ウォッチモードで実行
npm test -- --watch
```

## 3. 実際のGitHubでのテスト

### 3.1 フォークしたリポジトリでテスト

1. このリポジトリをフォーク
2. フォークしたリポジトリで新しいブランチを作成
3. テスト用のworkflowファイルを作成:

```yaml
# .github/workflows/test-bundle-stats.yml
name: Test Bundle Stats

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # webpack-stats.jsonを生成（実際のプロジェクトではビルドステップ）
      - name: Create test stats file
        run: |
          cat > webpack-stats.json << 'EOF'
          {
            "version": "5.89.0",
            "assets": [
              {
                "name": "bundle.js",
                "size": 2621440,
                "emitted": true
              }
            ]
          }
          EOF

      # Bundle Stats Actionを実行
      - uses: ./
        with:
          stats-path: webpack-stats.json
          bundle-size-threshold: 2097152 # 2MB
          total-size-threshold: 10485760 # 10MB
          fail-on-threshold-exceed: true
```

4. PRを作成してアクションの動作を確認

### 3.2 別リポジトリでの使用

```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size Check

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build with stats
        run: npm run build -- --stats

      - name: Check bundle size
        uses: yk-lab/bundle-stats-action@v1
        with:
          stats-path: dist/webpack-stats.json
          bundle-size-threshold: 5242880 # 5MB
          total-size-threshold: 20971520 # 20MB
```

## 4. デバッグ

### 4.1 VSCodeでのデバッグ

`.vscode/launch.json`に以下を追加:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Action",
      "program": "${workspaceFolder}/src/main.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "INPUT_STATS-PATH": "webpack-stats.json",
        "INPUT_BUNDLE-SIZE-THRESHOLD": "2097152",
        "GITHUB_TOKEN": "${env:GITHUB_TOKEN}",
        "GITHUB_REPOSITORY": "owner/repo",
        "GITHUB_EVENT_NAME": "pull_request",
        "ACTIONS_STEP_DEBUG": "true"
      },
      "runtimeArgs": ["--loader", "ts-node/esm"],
      "console": "integratedTerminal"
    }
  ]
}
```

### 4.2 デバッグログの有効化

```bash
# 環境変数でデバッグモードを有効化
export ACTIONS_STEP_DEBUG=true
npm run local-action

# GitHub Actionsでデバッグログを有効化
# リポジトリのSecrets設定で ACTIONS_STEP_DEBUG = true を追加
```

### 4.3 トラブルシューティング

#### webpack-stats.jsonが見つからない

```bash
# ファイルの存在確認
ls -la webpack-stats.json

# 正しいパスを指定
INPUT_STATS-PATH=./dist/webpack-stats.json npm run local-action
```

#### GitHubトークンエラー

```bash
# トークンの権限確認（pull-requests: write が必要）
gh auth status

# 新しいトークンを生成
gh auth login
```

#### 閾値超過の動作確認

```bash
# 低い閾値でテスト
INPUT_BUNDLE-SIZE-THRESHOLD=1024 \
INPUT_TOTAL-SIZE-THRESHOLD=2048 \
npm run local-action
```

## 5. 実際のプロジェクトでの設定例

### 5.1 webpack設定

```javascript
// webpack.config.js
const { StatsWriterPlugin } = require('webpack-stats-plugin')

module.exports = {
  // ... 他の設定
  plugins: [
    new StatsWriterPlugin({
      filename: 'webpack-stats.json',
      stats: {
        assets: true,
        chunks: false,
        modules: false,
        source: false
      }
    })
  ]
}
```

### 5.2 Next.jsでの設定

```javascript
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new (require('webpack-stats-plugin').StatsWriterPlugin)({
          filename: '../webpack-stats.json',
          stats: { assets: true }
        })
      )
    }
    return config
  }
}
```

### 5.3 Create React Appでの設定

```bash
# ビルド時にstatsを生成
npm run build -- --stats

# または
GENERATE_SOURCEMAP=false npm run build -- --stats
```

## 6. 継続的な監視

### 6.1 メインブランチとの比較

将来的な機能として、ベースブランチのサイズと比較:

```yaml
- name: Checkout base branch
  uses: actions/checkout@v4
  with:
    ref: ${{ github.base_ref }}
    path: base

- name: Build base branch
  working-directory: base
  run: |
    npm ci
    npm run build -- --stats
    mv webpack-stats.json ../base-stats.json

- name: Checkout PR branch
  uses: actions/checkout@v4

- name: Build PR branch
  run: |
    npm ci  
    npm run build -- --stats

# 将来: 比較機能を追加
- uses: yk-lab/bundle-stats-action@v2
  with:
    stats-path: webpack-stats.json
    base-stats-path: base-stats.json # 将来機能
```

これらの手順に従って、ローカル環境とGitHub Actions環境の両方でBundle Stats
Actionをテストできます。
