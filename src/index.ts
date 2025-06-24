/**
 * Bundle Stats Action
 *
 * The entrypoint for the action. This file imports and runs the action's
 * main logic, and also exports the run function for testing purposes.
 */
export { run } from './main.js'

// Auto-execute when running as GitHub Action
/* istanbul ignore next */
if (process.env.GITHUB_ACTIONS) {
  import('./main.js').then(({ run }) => run())
}
