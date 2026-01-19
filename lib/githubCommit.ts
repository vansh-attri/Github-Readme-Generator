/**
 * GitHub Commit Utilities (V3)
 * 
 * Explicit, user-approved auto-commit of profile README to GitHub.
 * 
 * SCOPE: repo (required for write access)
 * PURPOSE: Commit README.md to username/username repo ONLY
 * 
 * CONSTRAINTS:
 * - Only commits to username/username repo
 * - Only commits README.md file
 * - Requires explicit user confirmation
 * - Single atomic commit
 * - Never auto-commits
 * - Never retries silently
 */

const GITHUB_API_BASE = 'https://api.github.com'

export interface CommitResult {
  success: boolean
  commitSha?: string
  commitUrl?: string
  error?: string
}

export interface RepoCheckResult {
  exists: boolean
  error?: string
}

export interface ReadmeCheckResult {
  exists: boolean
  content?: string
  sha?: string // Required for updates
  error?: string
}

/**
 * Checks if the user's profile repo (username/username) exists.
 */
export async function checkProfileRepoExists(
  username: string,
  accessToken: string
): Promise<RepoCheckResult> {
  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(username)}/${encodeURIComponent(username)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'github-readme-generator'
        }
      }
    )

    if (res.status === 404) {
      return { exists: false }
    }

    if (!res.ok) {
      return { exists: false, error: `GitHub API error: ${res.status}` }
    }

    return { exists: true }
  } catch (err: any) {
    return { exists: false, error: err?.message || 'Failed to check repository' }
  }
}

/**
 * Creates the user's profile repo (username/username).
 * Only called with explicit user permission.
 */
export async function createProfileRepo(
  username: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${GITHUB_API_BASE}/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'github-readme-generator'
      },
      body: JSON.stringify({
        name: username,
        description: 'My GitHub profile README',
        public: true,
        auto_init: false // We'll create the README ourselves
      })
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, error: data.message || `GitHub API error: ${res.status}` }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create repository' }
  }
}

/**
 * Fetches the current README.md from the profile repo.
 * Returns content and SHA (needed for updates).
 */
export async function fetchCurrentReadme(
  username: string,
  accessToken: string
): Promise<ReadmeCheckResult> {
  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(username)}/${encodeURIComponent(username)}/contents/README.md`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'github-readme-generator'
        }
      }
    )

    if (res.status === 404) {
      return { exists: false }
    }

    if (!res.ok) {
      return { exists: false, error: `GitHub API error: ${res.status}` }
    }

    const data = await res.json()

    // Content is base64 encoded
    const content = Buffer.from(data.content, 'base64').toString('utf-8')

    return {
      exists: true,
      content,
      sha: data.sha
    }
  } catch (err: any) {
    return { exists: false, error: err?.message || 'Failed to fetch README' }
  }
}

/**
 * Commits the README.md to the user's profile repo.
 * 
 * CONSTRAINTS:
 * - Only commits to username/username
 * - Only commits README.md
 * - Single atomic commit
 * - Requires SHA for updates (to prevent race conditions)
 */
export async function commitReadme(
  username: string,
  accessToken: string,
  content: string,
  existingSha?: string // Required for updates, undefined for new files
): Promise<CommitResult> {
  try {
    const body: Record<string, any> = {
      message: 'Update profile README via README Builder',
      content: Buffer.from(content).toString('base64'),
      branch: 'main'
    }

    // If updating existing file, include SHA to prevent conflicts
    if (existingSha) {
      body.sha = existingSha
    }

    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(username)}/${encodeURIComponent(username)}/contents/README.md`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'github-readme-generator'
        },
        body: JSON.stringify(body)
      }
    )

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      
      if (res.status === 401) {
        return { success: false, error: 'Permission denied. Please reconnect with write access.' }
      }
      if (res.status === 404) {
        return { success: false, error: 'Repository not found. Please create it first.' }
      }
      if (res.status === 409) {
        return { success: false, error: 'Conflict: README was modified elsewhere. Please refresh and try again.' }
      }
      if (res.status === 422) {
        return { success: false, error: 'Invalid request. The file may have been modified.' }
      }
      
      return { success: false, error: data.message || `GitHub API error: ${res.status}` }
    }

    const data = await res.json()

    return {
      success: true,
      commitSha: data.commit?.sha,
      commitUrl: data.commit?.html_url
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to commit README' }
  }
}
