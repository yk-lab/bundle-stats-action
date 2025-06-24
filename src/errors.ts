/**
 * Custom error classes for Bundle Stats Action
 */

import { ErrorLevel } from './types.js'

// Error codes
export const ErrorCode = {
  // File-related errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',

  // JSON parsing errors
  JSON_PARSE_ERROR: 'JSON_PARSE_ERROR',
  INVALID_STATS_FORMAT: 'INVALID_STATS_FORMAT',

  // GitHub API errors
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  COMMENT_NOT_FOUND: 'COMMENT_NOT_FOUND',

  // Configuration errors
  INVALID_CONFIG: 'INVALID_CONFIG',
  INVALID_THRESHOLD: 'INVALID_THRESHOLD',

  // Runtime errors
  MEMORY_LIMIT_ERROR: 'MEMORY_LIMIT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

/**
 * Custom error class for Bundle Stats Action
 */
export class BundleStatsError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly level: ErrorLevel,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'BundleStatsError'

    // Ensure proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BundleStatsError)
    }
  }

  /**
   * Convert error to user-friendly message
   */
  toUserMessage(): string {
    switch (this.code) {
      case ErrorCode.FILE_NOT_FOUND:
        return `📁 Could not find the stats file. Please ensure the webpack build has completed and the file exists at the specified path.`
      case ErrorCode.JSON_PARSE_ERROR:
        return `❌ Failed to parse the stats file. Please ensure it contains valid JSON.`
      case ErrorCode.INVALID_STATS_FORMAT:
        return `⚠️  The stats file format is invalid. Please ensure it's a webpack-stats.json file with an 'assets' array.`
      case ErrorCode.FILE_TOO_LARGE:
        return `📏 The stats file is too large to process. Consider using webpack's stats options to reduce file size.`
      case ErrorCode.GITHUB_API_ERROR:
        return `🔌 Failed to communicate with GitHub API. Please check your GITHUB_TOKEN permissions.`
      case ErrorCode.RATE_LIMIT_ERROR:
        return `⏱️  GitHub API rate limit exceeded. Please try again later.`
      case ErrorCode.INVALID_THRESHOLD:
        return `⚙️  Invalid threshold configuration. Please ensure threshold values are positive numbers.`
      default:
        return `❌ An unexpected error occurred: ${this.message}`
    }
  }
}

/**
 * Helper to create errors with consistent formatting
 */
export function createError(
  code: ErrorCode,
  message: string,
  level: ErrorLevel = 'error',
  details?: unknown
): BundleStatsError {
  return new BundleStatsError(message, code, level, details)
}
