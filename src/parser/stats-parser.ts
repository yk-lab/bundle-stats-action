/**
 * Webpack stats JSON parser
 */

import * as fs from 'fs'
import { WebpackStats } from '../types.js'
import { ErrorCode, createError } from '../errors.js'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * Parser for webpack-stats.json files
 */
export class StatsParser {
  /**
   * Read and parse webpack stats from file
   * @param filePath - Path to webpack-stats.json
   * @returns Parsed webpack stats
   * @throws {BundleStatsError} If file not found or invalid
   */
  async parseFile(filePath: string): Promise<WebpackStats> {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw createError(
        ErrorCode.FILE_NOT_FOUND,
        `Stats file not found: ${filePath}`,
        'fatal'
      )
    }

    // Check file size
    const stats = fs.statSync(filePath)
    if (stats.size > MAX_FILE_SIZE) {
      throw createError(
        ErrorCode.FILE_TOO_LARGE,
        `Stats file too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE} bytes)`,
        'fatal',
        { size: stats.size, maxSize: MAX_FILE_SIZE }
      )
    }

    // Read file
    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf-8')
    } catch (error) {
      throw createError(
        ErrorCode.FILE_READ_ERROR,
        `Failed to read stats file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'fatal',
        error
      )
    }

    return this.parse(content)
  }

  /**
   * Parse webpack stats from JSON string
   * @param content - JSON string content
   * @returns Parsed webpack stats
   * @throws {BundleStatsError} If JSON is invalid
   */
  parse(content: string): WebpackStats {
    let data: unknown

    try {
      data = JSON.parse(content)
    } catch (error) {
      throw createError(
        ErrorCode.JSON_PARSE_ERROR,
        `Invalid JSON in stats file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'fatal',
        error
      )
    }

    // Validate structure
    if (!this.isValidStats(data)) {
      throw createError(
        ErrorCode.INVALID_STATS_FORMAT,
        'Invalid webpack stats format: missing required "assets" array',
        'fatal',
        { data }
      )
    }

    return data
  }

  /**
   * Type guard to check if data is valid webpack stats
   * @param data - Unknown data to check
   * @returns True if valid webpack stats
   */
  private isValidStats(data: unknown): data is WebpackStats {
    return (
      typeof data === 'object' &&
      data !== null &&
      'assets' in data &&
      Array.isArray((data as Record<string, unknown>).assets)
    )
  }
}
