import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { fetchAuthenticatedUser } from '../../../../lib/githubOAuth'
import {
  checkProfileRepoExists,
  createProfileRepo,
  fetchCurrentReadme,
  commitReadme
} from '../../../../lib/githubCommit'

/**
 * POST /api/github/commit-readme
 * 
 * V3: Commits README.md to user's profile repo (username/username).
 * 
 * CONSTRAINTS:
 * - Requires explicit user action (this endpoint is never called automatically)
 * - Only commits to username/username repo
 * - Only commits README.md file
 * - Single atomic commit
 * - Requires write OAuth token
 * 
 * Input: { 
 *   action: 'check' | 'create-repo' | 'commit',
 *   content?: string (required for commit),
 *   confirmed?: boolean (required for commit)
 * }
 * 
 * Output varies by action:
 * - check: { repoExists, currentReadme, username }
 * - create-repo: { success, error? }
 * - commit: { success, commitSha?, commitUrl?, error? }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, content, confirmed } = body

    if (!action || !['check', 'create-repo', 'commit'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: check, create-repo, or commit' },
        { status: 400 }
      )
    }

    // Get write token from httpOnly cookie
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('github_write_token')?.value

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Write access not granted. Please connect GitHub with write permission.' },
        { status: 401 }
      )
    }

    // Verify the authenticated user
    const userResult = await fetchAuthenticatedUser(accessToken)

    if ('error' in userResult) {
      return NextResponse.json(
        { error: `Authentication failed: ${userResult.error}` },
        { status: 401 }
      )
    }

    const username = userResult.login

    // ACTION: check - Check repo and fetch current README
    if (action === 'check') {
      const repoCheck = await checkProfileRepoExists(username, accessToken)

      if (repoCheck.error) {
        return NextResponse.json({ 
          repoExists: false, 
          error: repoCheck.error,
          username 
        })
      }

      if (!repoCheck.exists) {
        return NextResponse.json({ 
          repoExists: false, 
          username,
          message: `Repository ${username}/${username} does not exist. This is required for a GitHub profile README.`
        })
      }

      // Fetch current README
      const readmeCheck = await fetchCurrentReadme(username, accessToken)

      return NextResponse.json({
        repoExists: true,
        username,
        currentReadme: readmeCheck.exists ? readmeCheck.content : null,
        readmeSha: readmeCheck.sha || null
      })
    }

    // ACTION: create-repo - Create the profile repo
    if (action === 'create-repo') {
      // Double-check it doesn't exist
      const repoCheck = await checkProfileRepoExists(username, accessToken)

      if (repoCheck.exists) {
        return NextResponse.json({ 
          success: true, 
          message: 'Repository already exists' 
        })
      }

      const createResult = await createProfileRepo(username, accessToken)

      if (!createResult.success) {
        return NextResponse.json(
          { success: false, error: createResult.error },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }

    // ACTION: commit - Commit the README
    if (action === 'commit') {
      // Validate required fields
      if (!content || typeof content !== 'string') {
        return NextResponse.json(
          { error: 'Content is required for commit' },
          { status: 400 }
        )
      }

      if (confirmed !== true) {
        return NextResponse.json(
          { error: 'Explicit confirmation required. Set confirmed: true' },
          { status: 400 }
        )
      }

      // Verify repo exists
      const repoCheck = await checkProfileRepoExists(username, accessToken)

      if (!repoCheck.exists) {
        return NextResponse.json(
          { error: `Repository ${username}/${username} does not exist. Please create it first.` },
          { status: 404 }
        )
      }

      // Get current README SHA (required for updates)
      const readmeCheck = await fetchCurrentReadme(username, accessToken)

      // Commit the README
      const commitResult = await commitReadme(
        username,
        accessToken,
        content,
        readmeCheck.sha // undefined for new files, SHA for updates
      )

      if (!commitResult.success) {
        return NextResponse.json(
          { success: false, error: commitResult.error },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        commitSha: commitResult.commitSha,
        commitUrl: commitResult.commitUrl,
        username
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    const message = err?.message || String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
