/**
 * Type definitions for Bundle Stats Action
 */

// Webpack Stats JSON format types
export interface WebpackStats {
  version?: string
  hash?: string
  time?: number
  assets: Asset[]
  chunks?: Chunk[]
  modules?: Module[]
  assetsByChunkName?: Record<string, string | string[]>
  namedChunkGroups?: Record<string, ChunkGroup>
}

export interface Asset {
  name: string
  size: number
  chunks?: (number | string)[]
  emitted?: boolean
  isOverSizeLimit?: boolean
}

export interface Chunk {
  id: number | string
  names: string[]
  size: number
  files?: string[]
  hash?: string
}

export interface ChunkGroup {
  chunks: (number | string)[]
  assets: string[]
  children?: Record<string, ChunkGroup>
}

export interface Module {
  id: number | string
  name: string
  size: number
}

// Analysis types
export interface AnalyzedAsset {
  name: string
  size: number
  sizeText: string
  exceeded: boolean
  chunkNames?: string[]
  isInitial?: boolean
}

export interface AnalysisResult {
  assets: AnalyzedAsset[]
  summary: {
    totalSize: number
    totalSizeText: string
    fileCount: number
    exceededFileCount: number
  }
  threshold: {
    individualExceeded: string[]
    totalExceeded: boolean
    anyExceeded: boolean
  }
}

// Configuration types
export interface Config {
  statsPath: string
  bundleSizeThreshold: number
  totalSizeThreshold: number
  failOnThresholdExceed: boolean
}

// GitHub context types
export interface PRContext {
  owner: string
  repo: string
  pull_number: number
}

// Error types
export type ErrorLevel = 'fatal' | 'error' | 'warning' | 'info'

export interface ErrorDetails {
  code: string
  level: ErrorLevel
  details?: unknown
}
