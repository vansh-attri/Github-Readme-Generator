/**
 * GitHub OAuth Utilities (V2.2 + V3)
 * 
 * V2.2: Read-only OAuth for identity verification and improved rate limits.
 * V3: Write OAuth for explicit, user-approved README commits.
 * 
 * SCOPES:
 * - read:user: Identity verification (V2.2)
 * - repo: Write access for README commits (V3) - ONLY with explicit user consent
 * 
 * ❌ NEVER: auto-commit, store tokens persistently, log tokens
 */

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'

// OAuth scopes
const OAUTH_SCOPE_READ = 'read:user'
const OAUTH_SCOPE_WRITE = 'repo' // V3: Required for committing to repos

/**
 * Generates the GitHub OAuth authorization URL.
 * Redirects user to GitHub for consent.
 * 
 * @param scope - 'read' for identity only, 'write' for commit access
 */
export function getGitHubAuthUrl(
  clientId: string, 
  redirectUri: string, 
  state: string,
  scope: 'read' | 'write' = 'read'
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scope === 'write' ? OAUTH_SCOPE_WRITE : OAUTH_SCOPE_READ,
    state: state,
    allow_signup: 'false' // Don't prompt for signup
  })

  return `${GITHUB_OAUTH_URL}?${params.toString()}`
}

/**
 * Exchanges the authorization code for an access token.
 * Token is returned but NEVER persisted.
 */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken: string } | { error: string }> {
  try {
    const res = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri
      })
    })

    const data = await res.json()

    if (data.error) {
      return { error: data.error_description || data.error }
    }

    if (!data.access_token) {
      return { error: 'No access token received' }
    }

    return { accessToken: data.access_token }
  } catch (err: any) {
    return { error: err?.message || 'Failed to exchange code for token' }
  }
}

/**
 * Fetches the authenticated user's profile to verify identity.
 * Uses token from current request only - not stored.
 */
export async function fetchAuthenticatedUser(accessToken: string): Promise<{
  login: string
  id: number
  name: string | null
  avatar_url: string
} | { error: string }> {
  try {
    const res = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'github-readme-generator-mvp'
      }
    })

    if (!res.ok) {
      if (res.status === 401) {
        return { error: 'Invalid or expired token' }
      }
      return { error: `GitHub API error: ${res.status}` }
    }

    const data = await res.json()

    return {
      login: data.login,
      id: data.id,
      name: data.name,
      avatar_url: data.avatar_url
    }
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch user profile' }
  }
}

/**
 * Generates a random state string for CSRF protection.
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}
