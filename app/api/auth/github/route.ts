import { NextResponse } from 'next/server'
import { getGitHubAuthUrl, generateOAuthState } from '../../../../lib/githubOAuth'

/**
 * GET /api/auth/github
 * 
 * Initiates GitHub OAuth flow (read-only).
 * Redirects user to GitHub for authorization.
 * 
 * Scope: read:user ONLY
 * Purpose: Verify identity, improve rate limits
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

  // Generate state for CSRF protection
  const state = generateOAuthState()

  // Build authorization URL
  const authUrl = getGitHubAuthUrl(clientId, redirectUri, state)

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
