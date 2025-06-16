/**
 * Markdown formatting utilities
 */

/**
 * Escape special characters for markdown table cells
 * @param text - Text to escape
 * @returns Escaped text safe for markdown tables
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/\|/g, '\\|')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Create a collapsible details section
 * @param summary - Summary text
 * @param content - Content to hide
 * @param open - Whether to show open by default
 * @returns Markdown details block
 */
export function createDetailsSection(
  summary: string,
  content: string,
  open = false
): string {
  const openAttr = open ? ' open' : ''
  return `<details${openAttr}>
<summary>${escapeMarkdown(summary)}</summary>

${content}
</details>`
}

/**
 * Create a markdown table
 * @param headers - Table headers
 * @param rows - Table data rows
 * @param alignment - Column alignments
 * @returns Formatted markdown table
 */
export function createTable(
  headers: string[],
  rows: string[][],
  alignment?: Array<'left' | 'center' | 'right'>
): string {
  const alignmentRow = headers.map((_, index) => {
    const align = alignment?.[index] || 'left'
    switch (align) {
      case 'center':
        return ':---:'
      case 'right':
        return '---:'
      default:
        return ':---'
    }
  })

  const headerRow = `| ${headers.join(' | ')} |`
  const alignRow = `| ${alignmentRow.join(' | ')} |`
  const dataRows = rows.map((row) => `| ${row.join(' | ')} |`).join('\n')

  return `${headerRow}\n${alignRow}\n${dataRows}`
}

/**
 * Add emoji status indicator based on condition
 * @param isGood - Whether the status is good
 * @param goodEmoji - Emoji for good status
 * @param badEmoji - Emoji for bad status
 * @returns Emoji string
 */
export function statusEmoji(
  isGood: boolean,
  goodEmoji = '✅',
  badEmoji = '❌'
): string {
  return isGood ? goodEmoji : badEmoji
}
