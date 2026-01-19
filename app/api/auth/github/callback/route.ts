import { NextResponse } from 'next/server'
import { exchangeCodeForToken, fetchAuthenticatedUser } from '../../../../../lib/githubOAuth'

/**
 * GET /api/auth/github/callback
 * 
 * Handles GitHub OAuth callback.
 * Exchanges code for token, verifies user, returns to app.
 * 
 * Token is passed to frontend via short-lived cookie for session use only.
 * Token is NEVER stored in database or localStorage.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const origin = url.origin

  // Handle OAuth denial
  if (error) {
    return NextResponse.redirect(`${origin}?oauth_error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}?oauth_error=no_code`)
  }

  // Verify state (CSRF protection)
  const cookieHeader = req.headers.get('cookie') || ''
  const stateCookie = cookieHeader
    .split(';')
    .find((c) => c.trim().startsWith('oauth_state='))
    ?.split('=')[1]
    ?.trim()

  if (!state || !stateCookie || state !== stateCookie) {
    return NextResponse.redirect(`${origin}?oauth_error=invalid_state`)
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}?oauth_error=not_configured`)
  }

  const redirectUri = `${origin}/api/auth/github/callback`

  // Exchange code for token
  const tokenResult = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri)

  if ('error' in tokenResult) {
    return NextResponse.redirect(`${origin}?oauth_error=${encodeURIComponent(tokenResult.error)}`)
  }

  const { accessToken } = tokenResult

  // Fetch authenticated user to verify identity
  const userResult = await fetchAuthenticatedUser(accessToken)

  if ('error' in userResult) {
    return NextResponse.redirect(`${origin}?oauth_error=${encodeURIComponent(userResult.error)}`)
  }

  // Success: redirect back to app with user info
  // Token is stored in httpOnly cookie for this session only
  const response = NextResponse.redirect(
    `${origin}?oauth_success=true&github_user=${encodeURIComponent(userResult.login)}`
  )

  // Set token in httpOnly cookie (not accessible to JS, used server-side only)
  response.cookies.set('github_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 3600, // 1 hour max - short session
    path: '/'
  })

  // Set user info in regular cookie (accessible to frontend for display)
  response.cookies.set('github_user', JSON.stringify({
    login: userResult.login,
    name: userResult.name,
    avatar_url: userResult.avatar_url
  }), {
    httpOnly: false, // Accessible to frontend
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 3600,
    path: '/'
  })

  // Clear the state cookie
  response.cookies.delete('oauth_state')

  return response
}
