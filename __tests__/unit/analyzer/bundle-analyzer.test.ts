/**
 * Unit tests for bundle analyzer
 */
import { describe, it, expect, beforeEach } from '@jest/globals'
import { BundleAnalyzer } from '../../../src/analyzer/bundle-analyzer.js'
import { WebpackStats, Config } from '../../../src/types.js'

describe('BundleAnalyzer', () => {
  let analyzer: BundleAnalyzer
  let config: Config

  beforeEach(() => {
    analyzer = new BundleAnalyzer()
    config = {
      statsPath: 'webpack-stats.json',
      bundleSizeThreshold: 2097152, // 2MB
      totalSizeThreshold: 10485760, // 10MB
      failOnThresholdExceed: true
    }
  })

  describe('analyze', () => {
    it('should analyze assets and detect threshold violations', () => {
      const stats: WebpackStats = {
        assets: [
          { name: 'main.js', size: 1048576, emitted: true }, // 1MB
          { name: 'vendor.js', size: 3145728, emitted: true }, // 3MB - exceeds
          { name: 'styles.css', size: 524288, emitted: true }, // 512KB
          { name: 'main.js.map', size: 2097152, emitted: true }, // 2MB - should be filtered
          { name: 'vendor.js.LICENSE.txt', size: 1024, emitted: true } // 1KB - should be filtered
        ]
      }

      const result = analyzer.analyze(stats, config)

      // Check summary
      expect(result.summary.fileCount).toBe(3) // Excludes .map and .LICENSE.txt
      expect(result.summary.totalSize).toBe(4718592) // 1MB + 3MB + 512KB
      expect(result.summary.totalSizeText).toBe('4.50 MB')
      expect(result.summary.exceededFileCount).toBe(1)

      // Check thresholds
      expect(result.threshold.individualExceeded).toEqual(['vendor.js'])
      expect(result.threshold.totalExceeded).toBe(false)
      expect(result.threshold.anyExceeded).toBe(true)

      // Check assets are sorted by size
      expect(result.assets[0].name).toBe('vendor.js')
      expect(result.assets[1].name).toBe('main.js')
      expect(result.assets[2].name).toBe('styles.css')

      // Check chunk names
      expect(result.assets[0].chunkNames).toEqual([])
      expect(result.assets[1].chunkNames).toEqual([])
      expect(result.assets[2].chunkNames).toEqual([])
    })

    it('should detect total size threshold violation', () => {
      const stats: WebpackStats = {
        assets: [
          { name: 'bundle1.js', size: 4194304, emitted: true }, // 4MB
          { name: 'bundle2.js', size: 4194304, emitted: true }, // 4MB
          { name: 'bundle3.js', size: 4194304, emitted: true } // 4MB
        ]
      }

      const result = analyzer.analyze(stats, config)

      expect(result.summary.totalSize).toBe(12582912) // 12MB
      expect(result.threshold.totalExceeded).toBe(true)
      expect(result.threshold.anyExceeded).toBe(true)
    })

    it('should handle empty assets', () => {
      const stats: WebpackStats = {
        assets: []
      }

      const result = analyzer.analyze(stats, config)

      expect(result.summary.fileCount).toBe(0)
      expect(result.summary.totalSize).toBe(0)
      expect(result.threshold.anyExceeded).toBe(false)
    })

    it('should filter non-emitted assets', () => {
      const stats: WebpackStats = {
        assets: [
          { name: 'main.js', size: 1048576, emitted: true },
          { name: 'skipped.js', size: 1048576, emitted: false }
        ]
      }

      const result = analyzer.analyze(stats, config)

      expect(result.summary.fileCount).toBe(1)
      expect(result.assets).toHaveLength(1)
      expect(result.assets[0].name).toBe('main.js')
    })
  })

  describe('getTopAssets', () => {
    it('should return top N assets', () => {
      const assets = [
        { name: 'a.js', size: 3000, sizeText: '3 KB', exceeded: false },
        { name: 'b.js', size: 2000, sizeText: '2 KB', exceeded: false },
        { name: 'c.js', size: 1000, sizeText: '1 KB', exceeded: false }
      ]

      const top2 = analyzer.getTopAssets(assets, 2)
      expect(top2).toHaveLength(2)
      expect(top2[0].name).toBe('a.js')
      expect(top2[1].name).toBe('b.js')
    })
  })

  describe('groupByExtension', () => {
    it('should group assets by file extension', () => {
      const assets = [
        { name: 'main.js', size: 1000, sizeText: '1 KB', exceeded: false },
        { name: 'vendor.js', size: 2000, sizeText: '2 KB', exceeded: false },
        { name: 'styles.css', size: 500, sizeText: '500 B', exceeded: false },
        {
          name: 'bundle.min.js',
          size: 1500,
          sizeText: '1.5 KB',
          exceeded: false
        }
      ]

      const groups = analyzer.groupByExtension(assets)

      expect(groups.get('.js')).toHaveLength(2)
      expect(groups.get('.css')).toHaveLength(1)
      expect(groups.get('.min.js')).toHaveLength(1)
    })
  })

  describe('chunk mapping', () => {
    it('should map assets to chunk names using assetsByChunkName', () => {
      const stats: WebpackStats = {
        assets: [
          { name: 'main.a1b2c3.js', size: 1048576, emitted: true },
          { name: 'vendor.d4e5f6.js', size: 2097152, emitted: true },
          { name: 'styles.g7h8i9.css', size: 524288, emitted: true }
        ],
        assetsByChunkName: {
          main: ['main.a1b2c3.js', 'styles.g7h8i9.css'],
          vendor: 'vendor.d4e5f6.js'
        }
      }

      const result = analyzer.analyze(stats, config)

      expect(result.assets[0].name).toBe('vendor.d4e5f6.js')
      expect(result.assets[0].chunkNames).toEqual(['vendor'])

      expect(result.assets[1].name).toBe('main.a1b2c3.js')
      expect(result.assets[1].chunkNames).toEqual(['main'])

      expect(result.assets[2].name).toBe('styles.g7h8i9.css')
      expect(result.assets[2].chunkNames).toEqual(['main'])
    })

    it('should map assets using chunks information', () => {
      const stats: WebpackStats = {
        assets: [{ name: 'app.bundle.js', size: 1048576, emitted: true }],
        chunks: [
          {
            id: 0,
            names: ['app', 'main'],
            size: 1048576,
            files: ['app.bundle.js']
          }
        ]
      }

      const result = analyzer.analyze(stats, config)

      expect(result.assets[0].chunkNames).toEqual(['app', 'main'])
    })
  })
})
