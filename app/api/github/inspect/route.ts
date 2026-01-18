import { NextResponse } from 'next/server'
import { fetchPublicRepos } from '../../../../lib/githubInspector'
import { filterAndRankRepos, extractLanguages } from '../../../../lib/repoRanker'
import { generateSuggestions } from '../../../../lib/suggestionsEngine'
import type { GitHubInspectResponse } from '../../../../types'

/**
 * POST /api/github/inspect
 *
 * Input: { githubUsername: string }
 * Output: { username, repos, languages, suggestions }
 *
 * Fetches public GitHub data only (no auth).
 * Filters and ranks repos deterministically.
 * Returns suggestions (never auto-inserts).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { githubUsername } = body

    if (!githubUsername || typeof githubUsername !== 'string') {
      return NextResponse.json(
        { error: 'githubUsername is required' },
        { status: 400 }
      )
    }

    const username = githubUsername.trim()

    // Fetch public repos (unauthenticated)
    const rawRepos = await fetchPublicRepos(username)

    // Filter and rank (deterministic, no AI)
    const repos = filterAndRankRepos(rawRepos)

    // Extract languages
    const languages = extractLanguages(repos)

    // Generate suggestions (rules-based, no AI)
    const suggestions = generateSuggestions(repos, languages)

    const response: GitHubInspectResponse = {
      username,
      repos,
      languages,
      suggestions
    }

    return NextResponse.json(response)
  } catch (err: any) {
    const message = err?.message || String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
