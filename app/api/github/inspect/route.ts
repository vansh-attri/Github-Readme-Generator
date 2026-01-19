import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { fetchPublicRepos } from '../../../../lib/githubInspector'
import { filterAndRankRepos, extractLanguages } from '../../../../lib/repoRanker'
import { generateSuggestions } from '../../../../lib/suggestionsEngine'
import type { GitHubInspectResponse } from '../../../../types'

/**
 * POST /api/github/inspect
 *
 * Input: { githubUsername: string }
 * Output: { username, repos, languages, suggestions, authenticated }
 *
 * V2.2: Uses OAuth token if available for:
 * - Higher rate limits
 * - More reliable data
 * 
 * Data scope is IDENTICAL whether authenticated or not.
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

    // V2.2: Check for OAuth token (httpOnly cookie)
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('github_token')?.value

    // Fetch public repos (authenticated if token available, falls back to public)
    const rawRepos = await fetchPublicRepos(username, accessToken)

    // Filter and rank (deterministic, no AI)
    const repos = filterAndRankRepos(rawRepos)

    // Extract languages
    const languages = extractLanguages(repos)

    // Generate suggestions (rules-based, no AI)
    const suggestions = generateSuggestions(repos, languages)

    const response: GitHubInspectResponse & { authenticated?: boolean } = {
      username,
      repos,
      languages,
      suggestions,
      authenticated: !!accessToken // V2.2: Indicate if request was authenticated
    }

    return NextResponse.json(response)
  } catch (err: any) {
    const message = err?.message || String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
