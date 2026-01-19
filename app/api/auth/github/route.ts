import { NextResponse } from 'next/server'
import { getGitHubAuthUrl, generateOAuthState } from '../../../../lib/githubOAuth'

/**
 * GET /api/auth/github
 * 
 * Initiates GitHub OAuth flow.
 * Redirects user to GitHub for authorization.
 * 
 * Query params:
 * - scope: 'read' (default) or 'write'
 * 
 * V2.2: read:user scope for identity verification
 * V3: repo scope for README commits (requires explicit user action)
 */
export async function GET(req: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID

  if (!clientId) {
    return NextResponse.json(
      { error: 'GitHub OAuth not configured' },
      { status: 500 }
    )
  }

  // Determine redirect URI based on request origin
  const url = new URL(req.url)
  const origin = url.origin
  const redirectUri = `${origin}/api/auth/github/callback`

  // V3: Check if write scope is requested
  const scopeParam = url.searchParams.get('scope')
  const scope: 'read' | 'write' = scopeParam === 'write' ? 'write' : 'read'

  // Generate state for CSRF protection (include scope for callback)
  const state = generateOAuthState() + (scope === 'write' ? ':write' : ':read')

  // Build authorization URL
  const authUrl = getGitHubAuthUrl(clientId, redirectUri, state, scope)

  // Create response that redirects to GitHub
  const response = NextResponse.redirect(authUrl)

  // Store state in a short-lived cookie for verification
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/'
  })

  return response
}
