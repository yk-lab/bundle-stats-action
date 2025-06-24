/**
 * SVG badge generator for bundle size
 */

import { AnalysisResult } from '../types.js'

interface BadgeColors {
  background: string
  text: string
  valueBackground: string
  valueText: string
}

/**
 * Generates SVG badges for bundle size
 */
export class BadgeGenerator {
  private readonly colors = {
    success: {
      background: '#555',
      text: '#fff',
      valueBackground: '#4c1',
      valueText: '#fff'
    },
    warning: {
      background: '#555',
      text: '#fff',
      valueBackground: '#fe7d37',
      valueText: '#fff'
    },
    error: {
      background: '#555',
      text: '#fff',
      valueBackground: '#e05d44',
      valueText: '#fff'
    }
  }

  /**
   * Generate bundle size badge SVG
   * @param result - Analysis results
   * @returns SVG string
   */
  generate(result: AnalysisResult): string {
    const label = 'bundle size'
    const value = result.summary.totalSizeText
    const colors = this.getColors(result)

    return this.createBadge(label, value, colors)
  }

  /**
   * Generate status badge SVG
   * @param result - Analysis results
   * @returns SVG string
   */
  generateStatus(result: AnalysisResult): string {
    const label = 'bundle'
    const value = result.threshold.anyExceeded ? 'failing' : 'passing'
    const colors = this.getColors(result)

    return this.createBadge(label, value, colors)
  }

  /**
   * Get colors based on threshold status
   * @param result - Analysis results
   * @returns Badge colors
   */
  private getColors(result: AnalysisResult): BadgeColors {
    if (result.threshold.anyExceeded) {
      return this.colors.error
    } else if (result.summary.exceededFileCount > 0) {
      return this.colors.warning
    }
    return this.colors.success
  }

  /**
   * Create SVG badge
   * @param label - Badge label
   * @param value - Badge value
   * @param colors - Badge colors
   * @returns SVG string
   */
  private createBadge(
    label: string,
    value: string,
    colors: BadgeColors
  ): string {
    // Calculate text widths (rough approximation)
    const labelWidth = label.length * 7 + 10
    const valueWidth = value.length * 7 + 10
    const totalWidth = labelWidth + valueWidth

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="${colors.background}"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${colors.valueBackground}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${labelWidth * 5 + 5}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(labelWidth - 10) * 10}">${label}</text>
    <text x="${labelWidth * 5 + 5}" y="140" transform="scale(.1)" fill="${colors.text}" textLength="${(labelWidth - 10) * 10}">${label}</text>
    <text aria-hidden="true" x="${labelWidth * 10 + valueWidth * 5 - 5}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(valueWidth - 10) * 10}">${value}</text>
    <text x="${labelWidth * 10 + valueWidth * 5 - 5}" y="140" transform="scale(.1)" fill="${colors.valueText}" textLength="${(valueWidth - 10) * 10}">${value}</text>
  </g>
</svg>`
  }
}
