import type { GitHubRepoRaw, GitHubRepoNormalized } from '../types'
import { normalizeRepo } from './githubInspector'

/**
 * Filters and ranks repositories using deterministic rules only.
 * NO AI is used in this step.
 *
 * Filters out:
 * - Forks
 * - Archived repos
 * - Empty repos (size === 0)
 *
 * Ranks by:
 * 1. Stars (primary, descending)
 * 2. Recent activity (secondary, descending by updated_at)
 */
export function filterAndRankRepos(rawRepos: GitHubRepoRaw[]): GitHubRepoNormalized[] {
  // Step 1: Filter out forks, archived, empty
  const filtered = rawRepos.filter((r) => {
    if (r.fork) return false
    if (r.archived) return false
    if (r.size === 0) return false
    return true
  })

  // Step 2: Sort deterministically
  // Primary: stars (desc)
  // Secondary: updated_at (desc, more recent = higher)
  const sorted = [...filtered].sort((a, b) => {
    // Primary: stars
    if (b.stargazers_count !== a.stargazers_count) {
      return b.stargazers_count - a.stargazers_count
    }
    // Secondary: updated_at (ISO string comparison works for dates)
    return b.updated_at.localeCompare(a.updated_at)
  })

  // Step 3: Normalize
  return sorted.map(normalizeRepo)
}

/**
 * Extracts unique primary languages from repos (deterministic).
 */
export function extractLanguages(repos: GitHubRepoNormalized[]): string[] {
  const langSet = new Set<string>()
  for (const r of repos) {
    if (r.language && r.language !== 'Unknown') {
      langSet.add(r.language)
    }
  }
  return Array.from(langSet)
}
