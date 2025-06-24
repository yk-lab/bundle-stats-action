/**
 * Bundle Stats Action - Main entry point
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import { Config, PRContext } from './types.js'
import { BundleStatsError } from './errors.js'
import { StatsParser } from './parser/stats-parser.js'
import { BundleAnalyzer } from './analyzer/bundle-analyzer.js'
import { CommentFormatter } from './formatter/comment-formatter.js'
import { BadgeGenerator } from './formatter/badge-generator.js'
import { CommentManager } from './manager/comment-manager.js'

/**
 * The main function for the action.
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  let processingCommentId: number | undefined

  try {
    // Get configuration
    const config = getConfig()
    core.debug(`Config: ${JSON.stringify(config)}`)

    // Get GitHub context
    const prContext = getPRContext()
    if (!prContext) {
      core.info('Not running in a pull request context, skipping...')
      return
    }

    // Initialize GitHub client
    const token = process.env.GITHUB_TOKEN || core.getInput('github-token')
    if (!token) {
      throw new Error('GITHUB_TOKEN is required')
    }

    const octokit = github.getOctokit(token)
    const commentManager = new CommentManager(octokit, prContext)

    // Post processing comment
    try {
      const formatter = new CommentFormatter()
      processingCommentId = await commentManager.postProcessingComment(
        formatter.formatProcessing()
      )
      core.debug(`Posted processing comment: ${processingCommentId}`)
    } catch {
      core.warning('Failed to post processing comment, continuing...')
    }

    // Parse stats file
    core.info(`Reading stats from: ${config.statsPath}`)
    const parser = new StatsParser()
    const stats = await parser.parseFile(config.statsPath)
    core.info(`Found ${stats.assets.length} assets`)

    // Analyze bundle
    const analyzer = new BundleAnalyzer()
    const result = analyzer.analyze(stats, config)

    core.info(`Analysis complete:`)
    core.info(`  Total size: ${result.summary.totalSizeText}`)
    core.info(`  File count: ${result.summary.fileCount}`)
    core.info(`  Files exceeding limit: ${result.summary.exceededFileCount}`)

    // Generate comment
    const formatter = new CommentFormatter()
    const commentBody = formatter.format(result, config)

    // Generate badge
    const badgeGenerator = new BadgeGenerator()
    const badgeSvg = badgeGenerator.generate(result)

    // Delete processing comments
    if (processingCommentId) {
      try {
        await commentManager.deleteProcessingComments()
      } catch {
        core.warning('Failed to delete processing comments')
      }
    }

    // Post final comment
    await commentManager.postComment(commentBody)
    core.info('Successfully posted bundle size report')

    // Set outputs
    core.setOutput('comment-body', commentBody)
    core.setOutput('exceeded', result.threshold.anyExceeded.toString())
    core.setOutput('badge-svg', badgeSvg)

    // Fail if thresholds exceeded and configured to do so
    if (result.threshold.anyExceeded && config.failOnThresholdExceed) {
      core.setFailed('Bundle size thresholds exceeded')
    }
  } catch (error) {
    // Handle errors
    if (error instanceof BundleStatsError) {
      // Custom error with user-friendly message
      core.error(error.toUserMessage())

      if (error.level === 'fatal') {
        core.setFailed(error.message)
      } else {
        core.warning(error.message)
      }

      // Log details in debug mode
      if (core.isDebug() && error.details) {
        core.debug(`Error details: ${JSON.stringify(error.details, null, 2)}`)
      }
    } else if (error instanceof Error) {
      // Unknown error
      core.error(`Unexpected error: ${error.message}`)
      if (core.isDebug() && error.stack) {
        core.debug(`Stack trace:\n${error.stack}`)
      }
      core.setFailed(error.message)
    } else {
      // Non-Error thrown
      core.setFailed('An unknown error occurred')
    }
  }
}

/**
 * Get action configuration from inputs
 * @returns Parsed configuration
 */
function getConfig(): Config {
  const statsPath = core.getInput('stats-path') || 'webpack-stats.json'
  const bundleSizeThreshold = parseInt(
    core.getInput('bundle-size-threshold') || '2097152',
    10
  )
  const totalSizeThreshold = parseInt(
    core.getInput('total-size-threshold') || '10485760',
    10
  )
  const failOnThresholdExceed = core.getBooleanInput('fail-on-threshold-exceed')

  // Validate thresholds
  if (isNaN(bundleSizeThreshold) || bundleSizeThreshold <= 0) {
    throw new Error('bundle-size-threshold must be a positive number')
  }
  if (isNaN(totalSizeThreshold) || totalSizeThreshold <= 0) {
    throw new Error('total-size-threshold must be a positive number')
  }

  return {
    statsPath,
    bundleSizeThreshold,
    totalSizeThreshold,
    failOnThresholdExceed
  }
}

/**
 * Get PR context from GitHub context
 * @returns PR context or null if not in PR
 */
function getPRContext(): PRContext | null {
  const context = github.context

  if (
    context.eventName !== 'pull_request' &&
    context.eventName !== 'pull_request_target'
  ) {
    return null
  }

  const pullRequest = context.payload.pull_request
  if (!pullRequest) {
    return null
  }

  return {
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pullRequest.number
  }
}
