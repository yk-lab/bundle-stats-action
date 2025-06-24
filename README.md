# Bundle Stats Action

[![GitHub Super-Linter](https://github.com/yk-lab/bundle-stats-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/yk-lab/bundle-stats-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/yk-lab/bundle-stats-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/yk-lab/bundle-stats-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/yk-lab/bundle-stats-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/yk-lab/bundle-stats-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

English | [日本語](./README.ja.md)

A GitHub Action that analyzes webpack bundle stats and posts size reports to
pull requests. Perfect for small to medium projects that need cost-effective
bundle size monitoring without external services.

## 📚 Documentation

- [Architecture Overview](./docs/architecture.md) - System design and module
  structure
- [Data Structures](./docs/data-structures.md) - Input/output formats and
  internal data models
- [API Specifications](./docs/api-specifications.md) - GitHub API integration
  details
- [Error Handling](./docs/error-handling.md) - Error types and recovery
  strategies
- [Test Plan](./docs/test-plan.md) - Testing strategy and coverage goals
- [Implementation Guide](./docs/implementation-guide.md) - Coding standards and
  best practices
- [Development Setup](./docs/development-setup.md) - Local development
  environment guide
- [Deployment Guide](./docs/deployment-guide.md) - Release process and
  versioning

## 🚀 Features

- 📊 Analyzes webpack-stats.json and reports bundle sizes
- 💬 Posts/updates PR comments with size information
- 🚨 Fails CI when size thresholds are exceeded
- 📈 Tracks both individual file and total bundle sizes
- 🎯 Configurable size thresholds
- 📦 Collapsible file lists for better readability
- 🏷️ SVG badge generation for status
- ⚡ Fast and lightweight

## 📋 Requirements

- Node.js 20.19.x
- webpack configured to output stats JSON
- GitHub token with PR write permissions

## 🔧 Setup

After you've cloned the repository to your local machine or codespace, you'll
need to perform some initial setup steps before you can develop your action.

> [!NOTE]
>
> You'll need to have a reasonably modern version of
> [Node.js](https://nodejs.org) handy (20.19.x). If you are using a version
> manager like [`nodenv`](https://github.com/nodenv/nodenv) or
> [`fnm`](https://github.com/Schniz/fnm), this template has a `.node-version`
> file at the root of the repository that can be used to automatically switch to
> the correct version when you `cd` into the repository. Additionally, this
> `.node-version` file is used by GitHub Actions in any `actions/setup-node`
> actions.

1. :hammer_and_wrench: Install the dependencies

   ```bash
   npm install
   ```

1. :building_construction: Package the TypeScript for distribution

   ```bash
   npm run bundle
   ```

1. :white_check_mark: Run the tests

   ```bash
   $ npm test

   PASS  ./index.test.js
     ✓ throws invalid number (3ms)
     ✓ wait 500 ms (504ms)
     ✓ test runs (95ms)

   ...
   ```

## Update the Action Metadata

The [`action.yml`](action.yml) file defines metadata about your action, such as
input(s) and output(s). For details about this file, see
[Metadata syntax for GitHub Actions](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions).

When you copy this repository, update `action.yml` with the name, description,
inputs, and outputs for your action.

## Update the Action Code

The [`src/`](./src/) directory is the heart of your action! This contains the
source code that will be run when your action is invoked. You can replace the
contents of this directory with your own code.

There are a few things to keep in mind when writing your action code:

- Most GitHub Actions toolkit and CI/CD operations are processed asynchronously.
  In `main.ts`, you will see that the action is run in an `async` function.

  ```javascript
  import * as core from '@actions/core'
  //...

  async function run() {
    try {
      //...
    } catch (error) {
      core.setFailed(error.message)
    }
  }
  ```

  For more information about the GitHub Actions toolkit, see the
  [documentation](https://github.com/actions/toolkit/blob/master/README.md).

So, what are you waiting for? Go ahead and start customizing your action!

1. Create a new branch

   ```bash
   git checkout -b releases/v1
   ```

1. Replace the contents of `src/` with your action code
1. Add tests to `__tests__/` for your source code
1. Format, test, and build the action

   ```bash
   npm run all
   ```

   > This step is important! It will run [`rollup`](https://rollupjs.org/) to
   > build the final JavaScript action code with all dependencies included. If
   > you do not run this step, your action will not work correctly when it is
   > used in a workflow.

1. (Optional) Test your action locally

   The [`@github/local-action`](https://github.com/github/local-action) utility
   can be used to test your action locally. It is a simple command-line tool
   that "stubs" (or simulates) the GitHub Actions Toolkit. This way, you can run
   your TypeScript action locally without having to commit and push your changes
   to a repository.

   The `local-action` utility can be run in the following ways:

   - Visual Studio Code Debugger

     Make sure to review and, if needed, update
     [`.vscode/launch.json`](./.vscode/launch.json)

   - Terminal/Command Prompt

     ```bash
     # npx @github/local action <action-yaml-path> <entrypoint> <dotenv-file>
     npx @github/local-action . src/main.ts .env
     ```

   You can provide a `.env` file to the `local-action` CLI to set environment
   variables used by the GitHub Actions Toolkit. For example, setting inputs and
   event payload data used by your action. For more information, see the example
   file, [`.env.example`](./.env.example), and the
   [GitHub Actions Documentation](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables).

1. Commit your changes

   ```bash
   git add .
   git commit -m "My first action is ready!"
   ```

1. Push them to your repository

   ```bash
   git push -u origin releases/v1
   ```

1. Create a pull request and get feedback on your action
1. Merge the pull request into the `main` branch

Your action is now published! :rocket:

For information about versioning your action, see
[Versioning](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)
in the GitHub Actions toolkit.

## Validate the Action

You can now validate the action by referencing it in a workflow file. For
example, [`ci.yml`](./.github/workflows/ci.yml) demonstrates how to reference an
action in the same repository.

```yaml
steps:
  - name: Checkout
    id: checkout
    uses: actions/checkout@v4

  - name: Test Local Action
    id: test-action
    uses: ./
    with:
      GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}'

  - name: Print Output
    id: output
    run: echo "${{ steps.test-action.outputs.time }}"
```

For example workflow runs, check out the
[Actions tab](https://github.com/yk-lab/bundle-stats-action/actions)! :rocket:

## 📖 Usage

### Basic Configuration

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

      - name: Build project
        run: |
          npm install
          npm run build

      - name: Check Bundle Size
        uses: yk-lab/bundle-stats-action@v1
        with:
          stats-path: 'dist/webpack-stats.json'
          bundle-size-threshold: 2097152 # 2MB per file
          total-size-threshold: 10485760 # 10MB total
          fail-on-threshold-exceed: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Input Parameters

| Name                       | Type    | Default              | Description                                             |
| -------------------------- | ------- | -------------------- | ------------------------------------------------------- |
| `stats-path`               | string  | `webpack-stats.json` | Path to webpack stats JSON file                         |
| `bundle-size-threshold`    | number  | `2097152` (2MB)      | Individual file size threshold in bytes                 |
| `total-size-threshold`     | number  | `10485760` (10MB)    | Total bundle size threshold in bytes                    |
| `fail-on-threshold-exceed` | boolean | `true`               | Whether to fail the CI job when thresholds are exceeded |

### Output Parameters

| Name           | Type    | Description                                        |
| -------------- | ------- | -------------------------------------------------- |
| `comment-body` | string  | The Markdown content of the posted/updated comment |
| `exceeded`     | boolean | Whether any threshold was exceeded                 |
| `badge-svg`    | string  | SVG badge content for bundle size status           |

## Publishing a New Release

This project includes a helper script, [`script/release`](./script/release)
designed to streamline the process of tagging and pushing new releases for
GitHub Actions.

GitHub Actions allows users to select a specific version of the action to use,
based on release tags. This script simplifies this process by performing the
following steps:

1. **Retrieving the latest release tag:** The script starts by fetching the most
   recent SemVer release tag of the current branch, by looking at the local data
   available in your repository.
1. **Prompting for a new release tag:** The user is then prompted to enter a new
   release tag. To assist with this, the script displays the tag retrieved in
   the previous step, and validates the format of the inputted tag (vX.X.X). The
   user is also reminded to update the version field in package.json.
1. **Tagging the new release:** The script then tags a new release and syncs the
   separate major tag (e.g. v1, v2) with the new release tag (e.g. v1.0.0,
   v2.1.2). When the user is creating a new major release, the script
   auto-detects this and creates a `releases/v#` branch for the previous major
   version.
1. **Pushing changes to remote:** Finally, the script pushes the necessary
   commits, tags and branches to the remote repository. From here, you will need
   to create a new release in GitHub so users can easily reference the new tags
   in their workflows.

## Dependency License Management

This template includes a GitHub Actions workflow,
[`licensed.yml`](./.github/workflows/licensed.yml), that uses
[Licensed](https://github.com/licensee/licensed) to check for dependencies with
missing or non-compliant licenses. This workflow is initially disabled. To
enable the workflow, follow the below steps.

1. Open [`licensed.yml`](./.github/workflows/licensed.yml)
1. Uncomment the following lines:

   ```yaml
   # pull_request:
   #   branches:
   #     - main
   # push:
   #   branches:
   #     - main
   ```

1. Save and commit the changes

Once complete, this workflow will run any time a pull request is created or
changes pushed directly to `main`. If the workflow detects any dependencies with
missing or non-compliant licenses, it will fail the workflow and provide details
on the issue(s) found.

### Updating Licenses

Whenever you install or update dependencies, you can use the Licensed CLI to
update the licenses database. To install Licensed, see the project's
[Readme](https://github.com/licensee/licensed?tab=readme-ov-file#installation).

To update the cached licenses, run the following command:

```bash
licensed cache
```

To check the status of cached licenses, run the following command:

```bash
licensed status
```
