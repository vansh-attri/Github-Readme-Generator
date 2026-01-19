import type { GitHubRepoRaw, GitHubRepoNormalized } from '../types'

const GITHUB_API_BASE = 'https://api.github.com'

/**
 * Fetches public repositories for a GitHub user.
 * 
 * V2.2: Optionally accepts an access token for authenticated requests.
 * Authenticated requests have higher rate limits and more reliable data.
 * 
 * Data scope is IDENTICAL whether authenticated or not:
 * - Repos, descriptions, languages, stars, last updated
 * - Does NOT fetch: private repos, followers, commits, issues, PRs
 * 
 * @param username - GitHub username to fetch repos for
 * @param accessToken - Optional OAuth token for authenticated requests
 */
export async function fetchPublicRepos(
  username: string,
  accessToken?: string
): Promise<GitHubRepoRaw[]> {
  const url = `${GITHUB_API_BASE}/users/${encodeURIComponent(username)}/repos?type=public&per_page=100&sort=updated`

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'github-readme-generator-mvp'
  }

  // V2.2: Add authorization header if token provided
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const res = await fetch(url, { headers })

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`GitHub user "${username}" not found`)
    }
    throw new Error(`GitHub API error: ${res.status}`)
  }

  const data = await res.json()

  // Map to our raw type (only fields we need)
  const repos: GitHubRepoRaw[] = data.map((r: any) => ({
    name: r.name ?? '',
    description: r.description ?? null,
    language: r.language ?? null,
    stargazers_count: r.stargazers_count ?? 0,
    updated_at: r.updated_at ?? '',
    fork: r.fork ?? false,
    archived: r.archived ?? false,
    size: r.size ?? 0
  }))

  return repos
}

/**
 * Normalizes a raw repo into our clean structure.
 */
export function normalizeRepo(raw: GitHubRepoRaw): GitHubRepoNormalized {
  return {
    name: raw.name,
    description: raw.description || '',
    language: raw.language || 'Unknown',
    stars: raw.stargazers_count,
    lastUpdated: raw.updated_at
  }
}
