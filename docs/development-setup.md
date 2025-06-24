# Bundle Stats Action 開発環境セットアップガイド

## 1. 必要な環境

### 1.1 システム要件

| ツール     | 必要バージョン  | 確認コマンド    | インストール方法                             |
| ---------- | --------------- | --------------- | -------------------------------------------- |
| Node.js    | 20.19.x         | `node -v`       | [nodejs.org](https://nodejs.org/) or nvm/fnm |
| pnpm       | 10.x            | `pnpm -v`       | `npm install -g pnpm`                        |
| Git        | 2.x以上         | `git --version` | システムパッケージマネージャー               |
| GitHub CLI | 2.x以上（推奨） | `gh --version`  | [cli.github.com](https://cli.github.com/)    |

### 1.2 推奨エディタ

**Visual Studio Code** with extensions:

- ESLint
- Prettier - Code formatter
- TypeScript and JavaScript Language Features
- Jest Runner
- GitHub Actions
- Markdown All in One

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "jest.autoRun": {
    "watch": true,
    "onSave": "test-file"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## 2. 初期セットアップ

### 2.1 リポジトリのクローン

```bash
# HTTPSの場合
git clone https://github.com/yk-lab/bundle-stats-action.git

# SSHの場合（推奨）
git clone git@github.com:yk-lab/bundle-stats-action.git

# GitHub CLIの場合
gh repo clone yk-lab/bundle-stats-action

cd bundle-stats-action
```

### 2.2 依存関係のインストール

```bash
# pnpmを使用（必須）
pnpm install

# pnpmがない場合は先にインストール
npm install -g pnpm
```

### 2.3 Git フックのセットアップ

```bash
# Huskyのインストール（もし使用する場合）
pnpm add -D husky
pnpm husky install

# pre-commitフック
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm run format:check
pnpm run lint
EOF

chmod +x .husky/pre-commit
```

### 2.4 環境変数の設定

```bash
# .env.localファイルを作成（gitignoreされている）
cat > .env.local << 'EOF'
# GitHub Token for local testing
GITHUB_TOKEN=your_personal_access_token_here

# Test repository (optional)
TEST_REPO=your-username/test-repo
TEST_PR_NUMBER=1

# Debug mode
ACTIONS_STEP_DEBUG=true
EOF
```

## 3. 開発ワークフロー

### 3.1 ブランチ作成

```bash
# 最新のmainを取得
git checkout main
git pull origin main

# 機能ブランチ作成
git checkout -b feature/your-feature-name

# バグ修正ブランチ
git checkout -b fix/issue-description
```

### 3.2 開発サイクル

```bash
# 1. ウォッチモードで開発
pnpm run package:watch  # 別ターミナルで実行

# 2. テストをウォッチモードで実行
pnpm run test:watch     # 別ターミナルで実行

# 3. コードを編集

# 4. フォーマット確認
pnpm run format:check

# 5. リント実行
pnpm run lint

# 6. すべてのテスト実行
pnpm test

# 7. ビルド確認
pnpm run package
```

### 3.3 ローカルテスト実行

```bash
# アクションをローカルで実行
pnpm run local-action

# カスタム入力での実行
cat > .env.test << 'EOF'
INPUT_STATS-PATH=__fixtures__/webpack-stats-valid.json
INPUT_BUNDLE-SIZE-THRESHOLD=2097152
INPUT_TOTAL-SIZE-THRESHOLD=10485760
INPUT_FAIL-ON-THRESHOLD-EXCEED=true
GITHUB_TOKEN=your_token
GITHUB_REPOSITORY=owner/repo
GITHUB_EVENT_NAME=pull_request
EOF

pnpm run local-action . src/main.ts .env.test
```

## 4. テスト開発

### 4.1 単体テストの作成

```typescript
// __tests__/unit/parser/stats-parser.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals'
import { StatsParser } from '../../../src/parser/stats-parser'

describe('StatsParser', () => {
  let parser: StatsParser

  beforeEach(() => {
    parser = new StatsParser()
  })

  it('should parse valid stats', () => {
    // Arrange
    const input = '{"assets": []}'

    // Act
    const result = parser.parse(input)

    // Assert
    expect(result).toBeDefined()
    expect(result.assets).toEqual([])
  })
})
```

### 4.2 統合テストの作成

```typescript
// __tests__/integration/main.test.ts
import { run } from '../../src/main'
import * as core from '@actions/core'
import * as github from '@actions/github'

jest.mock('@actions/core')
jest.mock('@actions/github')

describe('Main integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // モック設定
    ;(core.getInput as jest.Mock).mockImplementation((name) => {
      const inputs: Record<string, string> = {
        'stats-path': '__fixtures__/webpack-stats-valid.json'
      }
      return inputs[name] || ''
    })
  })

  it('should complete successfully', async () => {
    await run()

    expect(core.setFailed).not.toHaveBeenCalled()
  })
})
```

### 4.3 フィクスチャの追加

```bash
# テストデータディレクトリ
mkdir -p __fixtures__

# サンプルstatsファイル作成
cat > __fixtures__/webpack-stats-sample.json << 'EOF'
{
  "version": "5.0.0",
  "hash": "abcdef123456",
  "time": 1234567890,
  "assets": [
    {
      "name": "main.js",
      "size": 1234567,
      "chunks": [0],
      "emitted": true
    }
  ]
}
EOF
```

## 5. デバッグ方法

### 5.1 Visual Studio Code デバッグ設定

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Action",
      "program": "${workspaceFolder}/src/main.ts",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "INPUT_STATS-PATH": "__fixtures__/webpack-stats-valid.json",
        "GITHUB_TOKEN": "${env:GITHUB_TOKEN}",
        "ACTIONS_STEP_DEBUG": "true"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Jest Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-coverage", "${file}"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### 5.2 ログとトレース

```typescript
// デバッグユーティリティ
import * as core from '@actions/core'

export class Debug {
  static log(message: string, data?: unknown): void {
    if (core.isDebug()) {
      core.debug(`[${new Date().toISOString()}] ${message}`)
      if (data) {
        core.debug(JSON.stringify(data, null, 2))
      }
    }
  }

  static time(label: string): void {
    if (core.isDebug()) {
      console.time(label)
    }
  }

  static timeEnd(label: string): void {
    if (core.isDebug()) {
      console.timeEnd(label)
    }
  }
}

// 使用例
Debug.log('Processing stats', { fileCount: stats.assets.length })
Debug.time('analysis')
const result = analyzer.analyze(stats)
Debug.timeEnd('analysis')
```

## 6. コード品質チェック

### 6.1 事前コミットチェック

```bash
# すべての品質チェックを実行
pnpm run all

# 個別実行
pnpm run format:write  # コード整形
pnpm run lint         # ESLintチェック
pnpm test            # テスト実行
pnpm run coverage    # カバレッジ確認
pnpm run package     # ビルド確認
```

### 6.2 型チェック

```bash
# TypeScript型チェック
pnpm tsc --noEmit

# 厳密モードでチェック
pnpm tsc --strict --noEmit
```

## 7. トラブルシューティング

### 7.1 よくある問題と解決策

| 問題                                   | 原因                           | 解決策                                       |
| -------------------------------------- | ------------------------------ | -------------------------------------------- |
| `pnpm: command not found`              | pnpmがインストールされていない | `npm install -g pnpm`                        |
| `Cannot find module '@actions/core'`   | 依存関係が不足                 | `pnpm install`                               |
| `GITHUB_TOKEN is not set`              | 環境変数が未設定               | `.env.local`に設定                           |
| `Jest encountered an unexpected token` | ESM/CJS混在                    | jest.config.jsの`extensionsToTreatAsEsm`確認 |
| `dist/ is out of date`                 | ビルド未実行                   | `pnpm run package`                           |

### 7.2 デバッグTips

```bash
# Node.jsデバッガーでの実行
node --inspect-brk ./node_modules/.bin/jest --runInBand

# メモリリーク調査
node --expose-gc --inspect ./src/index.js

# プロファイリング
node --prof ./src/index.js
node --prof-process isolate-*.log > profile.txt
```

## 8. リソース

### 8.1 ドキュメント

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [actions/toolkit](https://github.com/actions/toolkit)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

### 8.2 参考実装

- [actions/setup-node](https://github.com/actions/setup-node)
- [actions/cache](https://github.com/actions/cache)
- [actions/github-script](https://github.com/actions/github-script)

### 8.3 コミュニティ

- [GitHub Community Forum](https://github.community/)
- [Stack Overflow - GitHub Actions tag](https://stackoverflow.com/questions/tagged/github-actions)

## 9. 貢献ガイドライン

### 9.1 プルリクエストの作成

```markdown
## PR Description

### What

- 変更内容の簡潔な説明

### Why

- 変更の理由・背景

### How

- 実装方法の概要

### Testing

- [ ] 単体テストを追加/更新
- [ ] 統合テストを実行
- [ ] ローカルでアクションを実行

### Checklist

- [ ] コードはプロジェクトのスタイルガイドに従っている
- [ ] セルフレビューを実施した
- [ ] コメントを追加した（特に複雑な部分）
- [ ] ドキュメントを更新した
- [ ] 破壊的変更はない（ある場合は明記）
```

### 9.2 コードレビューのポイント

- 型安全性が保たれているか
- エラーハンドリングが適切か
- テストカバレッジが十分か
- パフォーマンスへの影響はないか
- セキュリティ上の問題はないか

この開発環境セットアップガイドに従うことで、スムーズに開発を開始できます。
