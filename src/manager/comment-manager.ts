/**
 * GitHub PR comment manager
 */

import * as github from '@actions/github'
import * as core from '@actions/core'
import { PRContext } from '../types.js'
import { BundleStatsError, ErrorCode, createError } from '../errors.js'
import {
  COMMENT_IDENTIFIER,
  PROCESSING_IDENTIFIER
} from '../formatter/comment-formatter.js'

type Octokit = ReturnType<typeof github.getOctokit>

/**
 * Manages GitHub PR comments
 */
export class CommentManager {
  constructor(
    private octokit: Octokit,
    private context: PRContext
  ) {}

  /**
   * Post or update PR comment
   * @param body - Comment body markdown
   * @returns Comment ID
   */
  async postComment(body: string): Promise<number> {
    try {
      // Try to find existing comment
      const existingComment = await this.findComment()

      if (existingComment) {
        // Update existing comment
        core.debug(`Updating existing comment ${existingComment.id}`)
        const { data } = await this.octokit.rest.issues.updateComment({
          ...this.context,
          comment_id: existingComment.id,
          body
        })
        return data.id
      } else {
        // Create new comment
        core.debug('Creating new comment')
        const { data } = await this.octokit.rest.issues.createComment({
          ...this.context,
          issue_number: this.context.pull_number,
          body
        })
        return data.id
      }
    } catch (error) {
      throw this.handleApiError(error, 'Failed to post comment')
    }
  }

  /**
   * Post processing state comment
   * @param body - Processing state body
   * @returns Comment ID
   */
  async postProcessingComment(body: string): Promise<number> {
    try {
      // Always create new processing comment
      const { data } = await this.octokit.rest.issues.createComment({
        ...this.context,
        issue_number: this.context.pull_number,
        body
      })
      return data.id
    } catch (error) {
      throw this.handleApiError(error, 'Failed to post processing comment')
    }
  }

  /**
   * Delete processing comments
   */
  async deleteProcessingComments(): Promise<void> {
    try {
      const comments = await this.listComments()

      const processingComments = comments.filter((comment) =>
        comment.body?.includes(PROCESSING_IDENTIFIER)
      )

      for (const comment of processingComments) {
        core.debug(`Deleting processing comment ${comment.id}`)
        await this.octokit.rest.issues.deleteComment({
          ...this.context,
          comment_id: comment.id
        })
      }
    } catch (error) {
      // Non-fatal: log warning but continue
      core.warning(`Failed to delete processing comments: ${error}`)
    }
  }

  /**
   * Find existing bundle stats comment
   * @returns Existing comment or null
   */
  private async findComment(): Promise<{ id: number; body?: string } | null> {
    const comments = await this.listComments()

    const bundleComment = comments.find((comment) =>
      comment.body?.includes(COMMENT_IDENTIFIER)
    )

    return bundleComment || null
  }

  /**
   * List all PR comments
   * @returns Array of comments
   */
  private async listComments(): Promise<Array<{ id: number; body?: string }>> {
    try {
      const { data } = await this.octokit.rest.issues.listComments({
        ...this.context,
        issue_number: this.context.pull_number,
        per_page: 100
      })

      return data
    } catch (error) {
      throw this.handleApiError(error, 'Failed to list comments')
    }
  }

  /**
   * Handle GitHub API errors
   * @param error - Original error
   * @param message - Context message
   * @returns Formatted error
   */
  private handleApiError(error: unknown, message: string): BundleStatsError {
    if (error instanceof Error) {
      // Check for rate limiting
      if (error.message.includes('rate limit')) {
        return createError(
          ErrorCode.RATE_LIMIT_ERROR,
          `${message}: GitHub API rate limit exceeded`,
          'error',
          error
        )
      }

      // Check for permissions
      if (error.message.includes('Resource not accessible')) {
        return createError(
          ErrorCode.GITHUB_API_ERROR,
          `${message}: Insufficient permissions. Ensure GITHUB_TOKEN has 'pull-requests: write' permission`,
          'fatal',
          error
        )
      }
    }

    return createError(
      ErrorCode.GITHUB_API_ERROR,
      `${message}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error',
      error
    )
  }
}
