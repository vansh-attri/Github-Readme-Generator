import type { GitHubRepoNormalized, Suggestion } from '../types'

const TOP_REPOS_LIMIT = 4
const RECENT_DAYS_THRESHOLD = 180 // ~6 months

/**
 * Generates suggestions based on GitHub data.
 * 100% deterministic, rules-based. NO AI.
 *
 * Each suggestion includes:
 * - type: 'repo' | 'section' | 'warning'
 * - message: human-readable suggestion
 * - data?: optional payload for applying
 */
export function generateSuggestions(
  repos: GitHubRepoNormalized[],
  languages: string[]
): Suggestion[] {
  const suggestions: Suggestion[] = []
  const now = Date.now()

  // 1. Recommend top repos to feature
  if (repos.length > 0) {
    const topRepos = repos.slice(0, TOP_REPOS_LIMIT)
    suggestions.push({
      type: 'repo',
      message: `We recommend featuring these repositories: ${topRepos.map((r) => r.name).join(', ')}`,
      data: { repos: topRepos }
    })
  } else {
    suggestions.push({
      type: 'warning',
      message: 'No public repositories found for this user.'
    })
  }

  // 2. Check for recent activity
  const recentRepos = repos.filter((r) => {
    const updated = new Date(r.lastUpdated).getTime()
    const daysSince = (now - updated) / (1000 * 60 * 60 * 24)
    return daysSince <= RECENT_DAYS_THRESHOLD
  })

  if (repos.length > 0 && recentRepos.length === 0) {
    suggestions.push({
      type: 'warning',
      message: 'Your profile has no recently active repositories (last 6 months).'
    })
  }

  // 3. Detected languages
  if (languages.length > 0) {
    suggestions.push({
      type: 'section',
      message: `Primary languages detected: ${languages.join(', ')}`,
      data: { languages }
    })
  }

  // 4. Generate individual repo suggestions for apply
  const topRepos = repos.slice(0, TOP_REPOS_LIMIT)
  for (const repo of topRepos) {
    suggestions.push({
      type: 'repo',
      message: `Add "${repo.name}" to featured projects`,
      data: {
        project: {
          name: repo.name,
          impact: repo.description || 'A project on GitHub'
        }
      }
    })
  }

  return suggestions
}
