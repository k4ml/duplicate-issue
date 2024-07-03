import * as core from '@actions/core'
import * as github from '@actions/github'
import mustache from 'mustache'
import { Octokit } from './octokit'
import { Util } from './util'

export namespace Action {
  export async function run() {
    try {
      const { context } = github
      const { issue } = context.payload
      const { comment } = context.payload

      if (
        !Util.isValidEvent('issue_comment', 'created') ||
        !issue ||
        !comment
      ) {
        core.warning('This action is only supposed on issue comment created.')
        return
      }

      const commentBody = comment.body as string
      const firstLine = commentBody.split(/\r?\n/)[0].trim()
      // Check if the first line of the comment is a slash command
      if (firstLine.length < 2 || firstLine.charAt(0) !== '/') {
        core.debug(
          'The first line of the comment is not a valid slash command.',
        )
        return
      }

      const { command } = Util.tokeniseCommand(firstLine.slice(1))
      if (command !== core.getInput('command')) {
        return
      }

      if (
        core.getInput('who') === 'author' &&
        issue.user.login !== comment.user.login
      ) {
        core.info(`Denied, ${comment.user.login} is not the issue owner.`)
        return
      }

      let body = core.getInput('extras')
      if (body) {
        body = mustache.render(body, {
          author: comment.user.login,
          issueNumber: issue.number,
          issueUrl: issue.html_url,
        })
      }

      if (issue.body) {
        body = issue.body + (body ? `\n\n${body}` : '')
      }

      const octokit = Octokit.get()
      await octokit.rest.issues.create({
        ...context.repo,
        body,
        title: issue.title,
        labels: issue.labels,
        owner: context.repo.owner,
        milestone: issue.milestone ? issue.milestone.number : undefined,
      })
    } catch (e) {
      core.error(e)
      core.setFailed(e.message)
    }
  }
}
