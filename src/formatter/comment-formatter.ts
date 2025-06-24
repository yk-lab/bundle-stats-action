/**
 * PR comment formatter
 */

import { AnalysisResult, Config, AnalyzedAsset } from '../types.js'
import { formatFileSize } from '../utils/file-size.js'
import {
  escapeMarkdown,
  createTable,
  createDetailsSection,
  statusEmoji
} from '../utils/markdown.js'

export const COMMENT_IDENTIFIER = '<!-- bundle-stats-action -->'
export const PROCESSING_IDENTIFIER = '<!-- bundle-stats-action-processing -->'

/**
 * Formats analysis results into PR comment
 */
export class CommentFormatter {
  /**
   * Format analysis results as markdown comment
   * @param result - Analysis results
   * @param config - Configuration
   * @returns Formatted markdown string
   */
  format(result: AnalysisResult, config: Config): string {
    const parts: string[] = [
      COMMENT_IDENTIFIER,
      this.formatHeader(result),
      '',
      this.formatSummary(result, config),
      ''
    ]

    // Add threshold warnings if any
    if (result.threshold.anyExceeded) {
      parts.push(this.formatThresholdWarnings(result, config))
      parts.push('')
    }

    // Add file list
    parts.push(this.formatFileList(result))

    return parts.join('\n')
  }

  /**
   * Format processing state comment
   * @returns Processing state markdown
   */
  formatProcessing(): string {
    return `${PROCESSING_IDENTIFIER}
## 📊 Bundle Size Report

⏳ Analyzing bundle size...`
  }

  /**
   * Format header section
   * @param result - Analysis results
   * @returns Header markdown
   */
  private formatHeader(result: AnalysisResult): string {
    const emoji = result.threshold.anyExceeded ? '⚠️' : '✅'
    return `## ${emoji} Bundle Size Report`
  }

  /**
   * Format summary section
   * @param result - Analysis results
   * @param config - Configuration
   * @returns Summary markdown
   */
  private formatSummary(result: AnalysisResult, config: Config): string {
    const { summary, threshold } = result

    const rows = [
      [
        '**Total Size**',
        summary.totalSizeText,
        statusEmoji(!threshold.totalExceeded),
        threshold.totalExceeded
          ? `Exceeds limit of ${formatFileSize(config.totalSizeThreshold)}`
          : 'Within limit'
      ],
      [
        '**Files**',
        summary.fileCount.toString(),
        statusEmoji(summary.exceededFileCount === 0),
        summary.exceededFileCount > 0
          ? `${summary.exceededFileCount} file(s) exceed individual limit`
          : 'All within limit'
      ]
    ]

    return createTable(['Metric', 'Value', 'Status', 'Details'], rows, [
      'left',
      'right',
      'center',
      'left'
    ])
  }

  /**
   * Format threshold warning section
   * @param result - Analysis results
   * @param config - Configuration
   * @returns Warning markdown
   */
  private formatThresholdWarnings(
    result: AnalysisResult,
    config: Config
  ): string {
    const warnings: string[] = []

    if (result.threshold.totalExceeded) {
      warnings.push(
        `❌ **Total bundle size (${result.summary.totalSizeText}) exceeds limit of ${formatFileSize(config.totalSizeThreshold)}**`
      )
    }

    if (result.threshold.individualExceeded.length > 0) {
      const fileList = result.threshold.individualExceeded
        .slice(0, 5)
        .map((name) => `  - ${escapeMarkdown(name)}`)
        .join('\n')

      const more =
        result.threshold.individualExceeded.length > 5
          ? `\n  - ...and ${result.threshold.individualExceeded.length - 5} more`
          : ''

      warnings.push(
        `❌ **Files exceeding ${formatFileSize(config.bundleSizeThreshold)} limit:**\n${fileList}${more}`
      )
    }

    return `### ⚠️ Threshold Warnings\n\n${warnings.join('\n\n')}`
  }

  /**
   * Format file list section
   * @param result - Analysis results
   * @returns File list markdown
   */
  private formatFileList(result: AnalysisResult): string {
    const { assets } = result

    // Show top 20 files, rest in collapsible section
    const topFiles = assets.slice(0, 20)
    const remainingFiles = assets.slice(20)

    const fileRows = topFiles.map((asset) => [
      this.formatAssetName(asset),
      asset.sizeText,
      asset.exceeded ? '❌' : '✅'
    ])

    let content = `### 📦 File Sizes\n\n`
    content += createTable(['File', 'Size', 'Status'], fileRows, [
      'left',
      'right',
      'center'
    ])

    // Add collapsible section for remaining files
    if (remainingFiles.length > 0) {
      const remainingRows = remainingFiles.map((asset) => [
        this.formatAssetName(asset),
        asset.sizeText,
        asset.exceeded ? '❌' : '✅'
      ])

      const remainingTable = createTable(
        ['File', 'Size', 'Status'],
        remainingRows,
        ['left', 'right', 'center']
      )

      content +=
        '\n\n' +
        createDetailsSection(
          `Show ${remainingFiles.length} more files`,
          remainingTable
        )
    }

    return content
  }

  /**
   * Format asset name with chunk information
   * @param asset - Analyzed asset
   * @returns Formatted asset name with chunk names
   */
  private formatAssetName(asset: AnalyzedAsset): string {
    const fileName = escapeMarkdown(asset.name)

    if (asset.chunkNames && asset.chunkNames.length > 0) {
      const chunks = asset.chunkNames.map((name) => `\`${name}\``).join(', ')
      return `${fileName} (${chunks})`
    }

    return fileName
  }
}
