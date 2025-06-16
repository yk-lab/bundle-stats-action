/**
 * Unit tests for file size utilities
 */
import { describe, it, expect } from '@jest/globals'
import {
  formatFileSize,
  calculatePercentageChange,
  formatSizeDiff
} from '../../../src/utils/file-size.js'

describe('formatFileSize', () => {
  it('should format bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1024)).toBe('1.00 KB')
    expect(formatFileSize(1536)).toBe('1.50 KB')
    expect(formatFileSize(1048576)).toBe('1.00 MB')
    expect(formatFileSize(1572864)).toBe('1.50 MB')
    expect(formatFileSize(104857600)).toBe('100 MB')
    expect(formatFileSize(1073741824)).toBe('1.00 GB')
  })

  it('should handle negative values', () => {
    expect(formatFileSize(-1024)).toBe('-1.00 KB')
    expect(formatFileSize(-1048576)).toBe('-1.00 MB')
  })

  it('should format with appropriate decimal places', () => {
    expect(formatFileSize(1024 * 1.234)).toBe('1.23 KB')
    expect(formatFileSize(1024 * 12.34)).toBe('12.3 KB')
    expect(formatFileSize(1024 * 123.4)).toBe('123 KB')
  })
})

describe('calculatePercentageChange', () => {
  it('should calculate percentage change correctly', () => {
    expect(calculatePercentageChange(120, 100)).toBe('+20.0%')
    expect(calculatePercentageChange(80, 100)).toBe('-20.0%')
    expect(calculatePercentageChange(100, 100)).toBe('+0.0%')
    expect(calculatePercentageChange(150, 100)).toBe('+50.0%')
    expect(calculatePercentageChange(50, 100)).toBe('-50.0%')
  })

  it('should handle edge cases', () => {
    expect(calculatePercentageChange(0, 0)).toBe('0%')
    expect(calculatePercentageChange(100, 0)).toBe('+∞%')
    expect(calculatePercentageChange(0, 100)).toBe('-100.0%')
  })
})

describe('formatSizeDiff', () => {
  it('should format size differences with indicators', () => {
    expect(formatSizeDiff(1024)).toBe('📈 +1.00 KB')
    expect(formatSizeDiff(-1024)).toBe('📉 -1.00 KB')
    expect(formatSizeDiff(0)).toBe('→ 0 B')
  })

  it('should use absolute values for formatting', () => {
    expect(formatSizeDiff(-1048576)).toBe('📉 -1.00 MB')
    expect(formatSizeDiff(1048576)).toBe('📈 +1.00 MB')
  })
})
