/**
 * Unit tests for webpack stats parser
 */
import { describe, it, expect, beforeEach } from '@jest/globals'
import { StatsParser } from '../../../src/parser/stats-parser.js'
import { ErrorCode } from '../../../src/errors.js'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('StatsParser', () => {
  let parser: StatsParser

  beforeEach(() => {
    parser = new StatsParser()
  })

  describe('parse', () => {
    it('should parse valid JSON stats', () => {
      const validStats = {
        assets: [{ name: 'main.js', size: 1024 }]
      }

      const result = parser.parse(JSON.stringify(validStats))
      expect(result).toEqual(validStats)
    })

    it('should throw error for invalid JSON', () => {
      expect(() => parser.parse('invalid json')).toThrow()

      // Separate test for error properties
      let caughtError: unknown
      try {
        parser.parse('invalid json')
      } catch (error) {
        caughtError = error
      }

      expect(caughtError).toBeDefined()
      expect((caughtError as { code: string }).code).toBe(
        ErrorCode.JSON_PARSE_ERROR
      )
      expect((caughtError as { level: string }).level).toBe('fatal')
    })

    it('should throw error for missing assets array', () => {
      const invalidStats = { version: '5.0.0' }

      expect(() => parser.parse(JSON.stringify(invalidStats))).toThrow()

      // Separate test for error properties
      let caughtError: unknown
      try {
        parser.parse(JSON.stringify(invalidStats))
      } catch (error) {
        caughtError = error
      }

      expect(caughtError).toBeDefined()
      expect((caughtError as { code: string }).code).toBe(
        ErrorCode.INVALID_STATS_FORMAT
      )
      expect((caughtError as { level: string }).level).toBe('fatal')
    })

    it('should accept stats with empty assets array', () => {
      const emptyStats = { assets: [] }
      const result = parser.parse(JSON.stringify(emptyStats))
      expect(result.assets).toEqual([])
    })
  })

  describe('parseFile', () => {
    const fixturesDir = path.join(__dirname, '..', '..', 'fixtures')

    it('should parse valid stats file', async () => {
      const filePath = path.join(fixturesDir, 'webpack-stats-valid.json')
      const result = await parser.parseFile(filePath)

      expect(result.assets).toBeDefined()
      expect(result.assets.length).toBeGreaterThan(0)
      expect(result.version).toBe('5.89.0')
    })

    it('should throw error for non-existent file', async () => {
      const filePath = path.join(fixturesDir, 'non-existent.json')

      await expect(parser.parseFile(filePath)).rejects.toThrow()

      // Separate test for error properties
      let caughtError: unknown
      try {
        await parser.parseFile(filePath)
      } catch (error) {
        caughtError = error
      }

      expect(caughtError).toBeDefined()
      expect((caughtError as { code: string }).code).toBe(
        ErrorCode.FILE_NOT_FOUND
      )
      expect((caughtError as { level: string }).level).toBe('fatal')
    })

    it('should throw error for invalid stats format', async () => {
      const filePath = path.join(fixturesDir, 'webpack-stats-invalid.json')

      await expect(parser.parseFile(filePath)).rejects.toThrow()

      // Separate test for error properties
      let caughtError: unknown
      try {
        await parser.parseFile(filePath)
      } catch (error) {
        caughtError = error
      }

      expect(caughtError).toBeDefined()
      expect((caughtError as { code: string }).code).toBe(
        ErrorCode.INVALID_STATS_FORMAT
      )
    })
  })
})
