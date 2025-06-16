/**
 * Unit tests for the action's main functionality
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import * as github from '../__fixtures__/github.js'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Mock modules
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => github)

// Import the module being tested dynamically
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Set default inputs
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'stats-path': path.join(
          __dirname,
          'fixtures',
          'webpack-stats-valid.json'
        ),
        'bundle-size-threshold': '2097152', // 2MB
        'total-size-threshold': '10485760', // 10MB
        'fail-on-threshold-exceed': 'true'
      }
      return inputs[name] || ''
    })

    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'fail-on-threshold-exceed' ? true : false
    })

    // Mock GitHub token
    process.env.GITHUB_TOKEN = 'mock-token'

    // Mock GitHub context for PR
    github.context.eventName = 'pull_request'
    github.context.repo = {
      owner: 'test-owner',
      repo: 'test-repo'
    }
    github.context.payload = {
      pull_request: {
        number: 123
      }
    }

    // Mock octokit
    const mockOctokit = {
      rest: {
        issues: {
          listComments: jest.fn(() => Promise.resolve({ data: [] })),
          createComment: jest.fn(() => Promise.resolve({ data: { id: 1 } })),
          updateComment: jest.fn(() => Promise.resolve({ data: { id: 1 } })),
          deleteComment: jest.fn(() => Promise.resolve({}))
        }
      }
    }

    github.getOctokit.mockReturnValue(mockOctokit)
  })

  afterEach(() => {
    jest.resetAllMocks()
    delete process.env.GITHUB_TOKEN
  })

  it('should analyze bundle and post comment successfully', async () => {
    await run()

    // Verify outputs were set
    expect(core.setOutput).toHaveBeenCalledWith(
      'comment-body',
      expect.stringContaining('Bundle Size Report')
    )
    expect(core.setOutput).toHaveBeenCalledWith('exceeded', 'true') // vendor.js exceeds threshold
    expect(core.setOutput).toHaveBeenCalledWith(
      'badge-svg',
      expect.stringContaining('<svg')
    )

    // Verify action failed due to threshold
    expect(core.setFailed).toHaveBeenCalledWith(
      'Bundle size thresholds exceeded'
    )
  })

  it('should skip when not in PR context', async () => {
    github.context.eventName = 'push'

    await run()

    expect(core.info).toHaveBeenCalledWith(
      'Not running in a pull request context, skipping...'
    )
    expect(core.setOutput).not.toHaveBeenCalled()
  })

  it('should handle missing GITHUB_TOKEN', async () => {
    delete process.env.GITHUB_TOKEN
    core.getInput.mockImplementation((name: string) => {
      if (name === 'github-token') return ''
      return name === 'stats-path' ? 'webpack-stats.json' : ''
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('GITHUB_TOKEN is required')
  })

  it('should handle missing stats file', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'stats-path') return 'non-existent-file.json'
      return ''
    })

    await run()

    expect(core.error).toHaveBeenCalledWith(
      expect.stringContaining('Could not find the stats file')
    )
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Stats file not found')
    )
  })

  it('should handle invalid threshold configuration', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'stats-path': path.join(
          __dirname,
          'fixtures',
          'webpack-stats-valid.json'
        ),
        'bundle-size-threshold': 'invalid'
      }
      return inputs[name] || ''
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'bundle-size-threshold must be a positive number'
    )
  })

  it('should not fail when threshold is not exceeded', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'stats-path': path.join(
          __dirname,
          'fixtures',
          'webpack-stats-valid.json'
        ),
        'bundle-size-threshold': '5242880', // 5MB - higher than all files
        'total-size-threshold': '20971520', // 20MB - higher than total
        'fail-on-threshold-exceed': 'false'
      }
      return inputs[name] || ''
    })

    core.getBooleanInput.mockReturnValue(false)

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('exceeded', 'false')
    expect(core.setFailed).not.toHaveBeenCalled()
  })
})
