/**
 * File size formatting utilities
 */

const SIZES = ['B', 'KB', 'MB', 'GB'] as const

/**
 * Format bytes to human readable string
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "1.23 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const negative = bytes < 0
  const absBytes = Math.abs(bytes)

  const k = 1024
  const i = Math.floor(Math.log(absBytes) / Math.log(k))
  const size = absBytes / Math.pow(k, i)

  // Format with appropriate decimal places
  let formatted: string
  if (i === 0) {
    // Bytes - no decimal places
    formatted = `${Math.round(size)} ${SIZES[i]}`
  } else if (size >= 100) {
    // Large numbers - no decimal places
    formatted = `${Math.round(size)} ${SIZES[i]}`
  } else if (size >= 10) {
    // Medium numbers - 1 decimal place
    formatted = `${size.toFixed(1)} ${SIZES[i]}`
  } else {
    // Small numbers - 2 decimal places
    formatted = `${size.toFixed(2)} ${SIZES[i]}`
  }

  return negative ? `-${formatted}` : formatted
}

/**
 * Calculate percentage change between two values
 * @param current - Current value
 * @param previous - Previous value
 * @returns Percentage change string (e.g., "+12.5%")
 */
export function calculatePercentageChange(
  current: number,
  previous: number
): string {
  if (previous === 0) {
    return current === 0 ? '0%' : '+∞%'
  }

  const change = ((current - previous) / previous) * 100
  const sign = change >= 0 ? '+' : ''

  return `${sign}${change.toFixed(1)}%`
}

/**
 * Format size difference with color coding
 * @param diff - Size difference in bytes
 * @returns Formatted string with emoji indicator
 */
export function formatSizeDiff(diff: number): string {
  const formatted = formatFileSize(Math.abs(diff))

  if (diff > 0) {
    return `📈 +${formatted}`
  } else if (diff < 0) {
    return `📉 -${formatted}`
  } else {
    return `→ ${formatted}`
  }
}
