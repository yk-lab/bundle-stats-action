/**
 * Mock for @actions/github module
 */
import { jest } from '@jest/globals'

// Mock context - must be a plain object that can be reassigned
export const context = {
  eventName: 'pull_request',
  repo: {
    owner: 'test-owner',
    repo: 'test-repo'
  },
  payload: {
    pull_request: {
      number: 123
    }
  }
}

// Mock getOctokit
export const getOctokit = jest.fn()
