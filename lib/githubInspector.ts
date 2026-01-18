import type { GitHubRepoRaw, GitHubRepoNormalized } from '../types'

const GITHUB_API_BASE = 'https://api.github.com'

/**
 * Fetches public repositories for a GitHub user.
 * Uses unauthenticated requests only (public data).
 * Does NOT fetch: private repos, followers, commits, issues, PRs.
 */
export async function fetchPublicRepos(username: string): Promise<GitHubRepoRaw[]> {
  const url = `${GITHUB_API_BASE}/users/${encodeURIComponent(username)}/repos?type=public&per_page=100&sort=updated`

  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'github-readme-generator-mvp'
    }
  })

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
