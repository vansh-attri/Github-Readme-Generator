import { NextResponse } from 'next/server'

/**
 * POST /api/auth/github/disconnect
 * 
 * Disconnects GitHub OAuth by clearing session cookies.
 * User can disconnect instantly at any time.
 * 
 * V3: Also clears write token.
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin

  const response = NextResponse.json({ success: true })

  // Clear all OAuth-related cookies (V2.2 + V3)
  response.cookies.delete('github_token')
  response.cookies.delete('github_write_token') // V3
  response.cookies.delete('github_user')
  response.cookies.delete('oauth_state')

  return response
}
