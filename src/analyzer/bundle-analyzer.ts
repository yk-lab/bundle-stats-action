/**
 * Bundle size analyzer
 */

import {
  WebpackStats,
  AnalysisResult,
  AnalyzedAsset,
  Config
} from '../types.js'
import { formatFileSize } from '../utils/file-size.js'

/**
 * Analyzes webpack bundle stats
 */
export class BundleAnalyzer {
  /**
   * Analyze webpack stats against configured thresholds
   * @param stats - Webpack stats data
   * @param config - Analysis configuration
   * @returns Analysis results
   */
  analyze(stats: WebpackStats, config: Config): AnalysisResult {
    // Build chunk mapping
    const chunkMapping = this.buildChunkMapping(stats)

    // Filter and analyze assets with chunk information
    const analyzedAssets = this.analyzeAssets(
      stats.assets,
      config.bundleSizeThreshold,
      chunkMapping
    )

    // Calculate summary
    const totalSize = analyzedAssets.reduce((sum, asset) => sum + asset.size, 0)
    const exceededFiles = analyzedAssets.filter((asset) => asset.exceeded)

    // Check thresholds
    const individualExceeded = exceededFiles.map((asset) => asset.name)
    const totalExceeded = totalSize > config.totalSizeThreshold

    return {
      assets: analyzedAssets,
      summary: {
        totalSize,
        totalSizeText: formatFileSize(totalSize),
        fileCount: analyzedAssets.length,
        exceededFileCount: exceededFiles.length
      },
      threshold: {
        individualExceeded,
        totalExceeded,
        anyExceeded: individualExceeded.length > 0 || totalExceeded
      }
    }
  }

  /**
   * Analyze individual assets
   * @param assets - Raw webpack assets
   * @param threshold - Size threshold in bytes
   * @param chunkMapping - Mapping of assets to chunk names
   * @returns Analyzed assets with formatted sizes
   */
  private analyzeAssets(
    assets: WebpackStats['assets'],
    threshold: number,
    chunkMapping: Map<string, string[]>
  ): AnalyzedAsset[] {
    return assets
      .filter((asset) => {
        // Skip source maps and other non-bundle files
        return (
          !asset.name.endsWith('.map') &&
          !asset.name.endsWith('.LICENSE.txt') &&
          asset.emitted !== false
        )
      })
      .map((asset) => ({
        name: asset.name,
        size: asset.size,
        sizeText: formatFileSize(asset.size),
        exceeded: asset.size > threshold,
        chunkNames: chunkMapping.get(asset.name) || [],
        isInitial:
          asset.isOverSizeLimit !== undefined
            ? !asset.isOverSizeLimit
            : undefined
      }))
      .sort((a, b) => b.size - a.size) // Sort by size descending
  }

  /**
   * Get top N largest assets
   * @param assets - Analyzed assets
   * @param limit - Number of assets to return
   * @returns Top N assets by size
   */
  getTopAssets(assets: AnalyzedAsset[], limit: number): AnalyzedAsset[] {
    return assets.slice(0, limit)
  }

  /**
   * Group assets by file extension
   * @param assets - Analyzed assets
   * @returns Map of extension to assets
   */
  groupByExtension(assets: AnalyzedAsset[]): Map<string, AnalyzedAsset[]> {
    const groups = new Map<string, AnalyzedAsset[]>()

    for (const asset of assets) {
      const ext = this.getExtension(asset.name)
      const group = groups.get(ext) || []
      group.push(asset)
      groups.set(ext, group)
    }

    return groups
  }

  /**
   * Extract file extension from filename
   * @param filename - File name
   * @returns File extension (e.g., '.js')
   */
  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.')
    if (lastDot === -1) return ''

    // Handle cases like .min.js
    const ext = filename.slice(lastDot)
    const secondLastDot = filename.lastIndexOf('.', lastDot - 1)
    if (
      secondLastDot !== -1 &&
      filename.slice(secondLastDot, lastDot) === '.min'
    ) {
      return filename.slice(secondLastDot)
    }

    return ext
  }

  /**
   * Build mapping of asset names to chunk names
   * @param stats - Webpack stats
   * @returns Map of asset name to chunk names
   */
  private buildChunkMapping(stats: WebpackStats): Map<string, string[]> {
    const mapping = new Map<string, string[]>()

    // Use assetsByChunkName if available
    if (stats.assetsByChunkName) {
      for (const [chunkName, assets] of Object.entries(
        stats.assetsByChunkName
      )) {
        const assetList = Array.isArray(assets) ? assets : [assets]
        for (const asset of assetList) {
          const existing = mapping.get(asset) || []
          existing.push(chunkName)
          mapping.set(asset, existing)
        }
      }
    }

    // Also use chunks information if available
    if (stats.chunks) {
      for (const chunk of stats.chunks) {
        if (chunk.files) {
          for (const file of chunk.files) {
            const existing = mapping.get(file) || []
            // Add chunk names that aren't already in the list
            for (const name of chunk.names) {
              if (!existing.includes(name)) {
                existing.push(name)
              }
            }
            mapping.set(file, existing)
          }
        }
      }
    }

    // Use namedChunkGroups as additional source
    if (stats.namedChunkGroups) {
      for (const [groupName, group] of Object.entries(stats.namedChunkGroups)) {
        for (const asset of group.assets) {
          const existing = mapping.get(asset) || []
          if (!existing.includes(groupName)) {
            existing.push(groupName)
          }
          mapping.set(asset, existing)
        }
      }
    }

    return mapping
  }
}
