"use client"

import React, { useEffect, useState, useRef } from 'react'
import type { ReadmeInputs, Suggestion, GitHubInspectResponse, HeuristicRecommendation, HeuristicsInput } from '../types'
import { generateHeuristicRecommendations, hasRecentActivity, calculateTotalStars } from '../lib/heuristicsEngine'

const defaultInputs: ReadmeInputs = {
  name: 'Your Name',
  username: 'your-github-username',
  careerStage: 'professional',
  role: 'Full-stack developer',
  techStack: ['TypeScript', 'React', 'Node.js'],
  featuredProjects: [
    { name: 'ExampleProject', impact: 'Small one-line description of impact' }
  ],
  profileGoal: 'job',
  tone: 'friendly',
  emojiPreference: 'light',
  sections: {
    whatIDo: true,
    techStack: true,
    projects: true,
    goal: true,
    connect: true
  }
}

export default function Page() {
  const [inputs, setInputs] = useState<ReadmeInputs>(defaultInputs)
  const [markdown, setMarkdown] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const timer = useRef<number | null>(null)

  // V2.0: GitHub inspection state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [inspecting, setInspecting] = useState(false)
  const [inspectError, setInspectError] = useState<string | null>(null)

  // V2.1: Heuristic recommendations state
  const [heuristicRecs, setHeuristicRecs] = useState<HeuristicRecommendation[]>([])
  const [githubDataForHeuristics, setGithubDataForHeuristics] = useState<HeuristicsInput['githubData']>(null)

  // V2.2: GitHub OAuth state
  const [githubUser, setGithubUser] = useState<{ login: string; name: string | null; avatar_url: string; hasWriteAccess?: boolean } | null>(null)
  const [oauthError, setOauthError] = useState<string | null>(null)

  // V3: Commit to GitHub state
  const [commitState, setCommitState] = useState<{
    step: 'idle' | 'checking' | 'no-repo' | 'preview' | 'confirming' | 'committing' | 'success' | 'error'
    repoExists?: boolean
    currentReadme?: string | null
    readmeSha?: string | null
    error?: string
    commitUrl?: string
  }>({ step: 'idle' })
  const [commitConfirmed, setCommitConfirmed] = useState(false)

  // V2.2: Check for OAuth status on mount and handle callback params
  useEffect(() => {
    // Check for existing GitHub user cookie
    const userCookie = document.cookie
      .split(';')
      .find((c) => c.trim().startsWith('github_user='))
      ?.split('=')
      .slice(1)
      .join('=')

    if (userCookie) {
      try {
        const user = JSON.parse(decodeURIComponent(userCookie))
        setGithubUser(user)
      } catch {
        // Invalid cookie, ignore
      }
    }

    // Handle OAuth callback params
    const params = new URLSearchParams(window.location.search)
    const success = params.get('oauth_success')
    const error = params.get('oauth_error')
    const login = params.get('github_user')

    if (success && login) {
      // Clean URL without reloading
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (error) {
      setOauthError(decodeURIComponent(error))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // V2.2: Disconnect GitHub OAuth
  async function disconnectGitHub() {
    try {
      await fetch('/api/auth/github/disconnect', { method: 'POST' })
      setGithubUser(null)
      setCommitState({ step: 'idle' })
      setCommitConfirmed(false)
      // Clear cookie client-side as well
      document.cookie = 'github_user=; path=/; max-age=0'
    } catch {
      // Ignore errors
    }
  }

  // V3: Start the commit flow - check repo and get current README
  async function startCommitFlow() {
    if (!githubUser?.hasWriteAccess) {
      // Need to get write access first
      return
    }

    setCommitState({ step: 'checking' })
    setCommitConfirmed(false)

    try {
      const res = await fetch('/api/github/commit-readme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' })
      })
      const data = await res.json()

      if (data.error) {
        setCommitState({ step: 'error', error: data.error })
        return
      }

      if (!data.repoExists) {
        setCommitState({ 
          step: 'no-repo', 
          repoExists: false,
          error: data.message 
        })
        return
      }

      setCommitState({
        step: 'preview',
        repoExists: true,
        currentReadme: data.currentReadme,
        readmeSha: data.readmeSha
      })
    } catch (err: any) {
      setCommitState({ step: 'error', error: err?.message || 'Failed to check repository' })
    }
  }

  // V3: Create the profile repo
  async function createProfileRepo() {
    setCommitState((s) => ({ ...s, step: 'checking' }))

    try {
      const res = await fetch('/api/github/commit-readme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-repo' })
      })
      const data = await res.json()

      if (!data.success) {
        setCommitState({ step: 'error', error: data.error || 'Failed to create repository' })
        return
      }

      // Now start the commit flow again
      await startCommitFlow()
    } catch (err: any) {
      setCommitState({ step: 'error', error: err?.message || 'Failed to create repository' })
    }
  }

  // V3: Execute the commit (only after explicit confirmation)
  async function executeCommit() {
    if (!commitConfirmed) {
      return // Safety check
    }

    setCommitState((s) => ({ ...s, step: 'committing' }))

    try {
      const res = await fetch('/api/github/commit-readme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'commit',
          content: markdown,
          confirmed: true
        })
      })
      const data = await res.json()

      if (!data.success) {
        setCommitState({ step: 'error', error: data.error || 'Failed to commit' })
        return
      }

      setCommitState({
        step: 'success',
        commitUrl: data.commitUrl
      })
      setCommitConfirmed(false)
    } catch (err: any) {
      setCommitState({ step: 'error', error: err?.message || 'Failed to commit' })
    }
  }

  // V3: Cancel the commit flow
  function cancelCommitFlow() {
    setCommitState({ step: 'idle' })
    setCommitConfirmed(false)
  }

  // V3: Generate a simple diff view
  function generateDiff(oldContent: string | null | undefined, newContent: string): string {
    if (!oldContent) {
      return '+ (New file - entire content will be added)'
    }
    
    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')
    
    let diff = ''
    const maxLines = Math.max(oldLines.length, newLines.length)
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i]
      const newLine = newLines[i]
      
      if (oldLine === newLine) {
        diff += `  ${newLine || ''}\n`
      } else if (oldLine === undefined) {
        diff += `+ ${newLine}\n`
      } else if (newLine === undefined) {
        diff += `- ${oldLine}\n`
      } else {
        diff += `- ${oldLine}\n`
        diff += `+ ${newLine}\n`
      }
    }
    
    return diff
  }

  // Generate README by calling backend
  async function generate(it: ReadmeInputs) {
    setLoading(true)
    try {
      const res = await fetch('/api/generate-readme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: it })
      })
      const data = await res.json()
      if (data.markdown) setMarkdown(data.markdown)
    } catch (err) {
      setMarkdown('Error generating README')
    } finally {
      setLoading(false)
    }
  }

  // Debounced auto-generate for live preview
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => generate(inputs), 500)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs])

  // V2.1: Regenerate heuristic recommendations when inputs or GitHub data change
  useEffect(() => {
    const heuristicsInput: HeuristicsInput = {
      userInputs: inputs,
      githubData: githubDataForHeuristics
    }
    const recs = generateHeuristicRecommendations(heuristicsInput)
    setHeuristicRecs(recs)
  }, [inputs, githubDataForHeuristics])

  // Handlers
  function update<K extends keyof ReadmeInputs>(key: K, value: ReadmeInputs[K]) {
    setInputs((s) => ({ ...s, [key]: value }))
  }

  function updateNestedSection<K extends keyof ReadmeInputs['sections']>(key: K, value: ReadmeInputs['sections'][K]) {
    setInputs((s) => ({ ...s, sections: { ...s.sections, [key]: value } }))
  }

  function parseProjects(raw: string) {
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
    const projects = lines.map((l) => {
      // accept 'Name — impact' or 'Name | impact' or 'Name: impact' or single name
      const parts = l.split(/—|\||:|-/).map(p => p.trim()).filter(Boolean)
      return { name: parts[0] || 'Project', impact: parts.slice(1).join(' — ') || 'One-line impact' }
    })
    update('featuredProjects', projects)
  }

  function handleCopy() {
    navigator.clipboard.writeText(markdown).then(() => {
      // noop
    })
  }

  function handleDownload() {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'README.md'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // V2.0: Inspect GitHub profile (public data only)
  async function inspectGitHub() {
    const username = inputs.username.trim()
    if (!username || username === 'your-github-username') {
      setInspectError('Please enter a valid GitHub username first.')
      return
    }
    setInspecting(true)
    setInspectError(null)
    setSuggestions([])
    setGithubDataForHeuristics(null)
    try {
      const res = await fetch('/api/github/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUsername: username })
      })
      const data: GitHubInspectResponse | { error: string } = await res.json()
      if ('error' in data) {
        setInspectError(data.error)
      } else {
        setSuggestions(data.suggestions)

        // V2.1: Store normalized GitHub data for heuristics engine
        const repoCount = data.repos.length
        const recentActivity = hasRecentActivity(data.repos)
        const totalStars = calculateTotalStars(data.repos)

        setGithubDataForHeuristics({
          repoCount,
          hasRecentActivity: recentActivity,
          primaryLanguages: data.languages,
          topRepos: data.repos.slice(0, 6),
          totalStars,
          forkRatio: 0 // Not available from normalized data; set to 0 as safe default
        })
      }
    } catch (err: any) {
      setInspectError(err?.message || 'Failed to inspect GitHub profile')
    } finally {
      setInspecting(false)
    }
  }

  // V2.0: Apply a suggestion (user explicitly approves)
  function applySuggestion(suggestion: Suggestion) {
    if (suggestion.data?.project) {
      // Add project to featured projects
      const project = suggestion.data.project
      setInputs((s) => ({
        ...s,
        featuredProjects: [
          ...s.featuredProjects.filter((p) => p.name !== project.name),
          project
        ]
      }))
    }
    if (suggestion.data?.languages) {
      // Merge languages into tech stack
      const langs = suggestion.data.languages
      setInputs((s) => ({
        ...s,
        techStack: Array.from(new Set([...s.techStack, ...langs]))
      }))
    }
    // Remove the applied suggestion from list
    setSuggestions((prev) => prev.filter((s) => s !== suggestion))
  }

  // V2.1: Apply a heuristic recommendation (user explicitly approves)
  function applyHeuristicRecommendation(rec: HeuristicRecommendation) {
    if (rec.suggestedAction) {
      const { type, target, value } = rec.suggestedAction

      if (target === 'tone' && type === 'change' && value) {
        setInputs((s) => ({ ...s, tone: value }))
      } else if (target === 'goal' && type === 'change' && value) {
        setInputs((s) => ({ ...s, goal: value }))
      } else if (target === 'techStack' && type === 'enable' && value) {
        setInputs((s) => ({
          ...s,
          techStack: Array.from(new Set([...s.techStack, ...(Array.isArray(value) ? value : [value])]))
        }))
      } else {
        // For other recommendations without direct state mapping, inform the user
        alert(`Recommendation: ${rec.message}`)
      }
    } else {
      // Informational recommendation (warnings, etc.)
      alert(`Note: ${rec.message}`)
    }
    // Remove the applied recommendation from list
    setHeuristicRecs((prev) => prev.filter((r) => r !== rec))
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, system-ui, -apple-system' }}>
      <div style={{ width: '44%', padding: 20, overflow: 'auto', borderRight: '1px solid #eee' }}>
        <h2>Inputs</h2>
        <label>
          Name
          <input value={inputs.name} onChange={(e) => update('name', e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          GitHub username
          <input value={inputs.username} onChange={(e) => update('username', e.target.value)} style={{ width: '100%' }} />
        </label>

        <label>
          Career stage
          <select value={inputs.careerStage} onChange={(e) => update('careerStage', e.target.value as any)}>
            <option value="student">student</option>
            <option value="professional">professional</option>
            <option value="founder">founder</option>
            <option value="open-source">open-source</option>
          </select>
        </label>

        <label>
          Primary role
          <input value={inputs.role} onChange={(e) => update('role', e.target.value)} style={{ width: '100%' }} />
        </label>

        <label>
          Tech stack (one per line)
          <textarea
            value={inputs.techStack.join('\n')}
            onChange={(e) => update('techStack', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
            style={{ width: '100%', minHeight: 80 }}
          />
        </label>

        <label>
          Featured projects (one per line — use “Name — impact”)
          <textarea
            defaultValue={inputs.featuredProjects.map(p=>`${p.name} — ${p.impact}`).join('\n')}
            onBlur={(e) => parseProjects(e.target.value)}
            style={{ width: '100%', minHeight: 80 }}
          />
        </label>

        <label>
          Profile goal
          <select value={inputs.profileGoal} onChange={(e) => update('profileGoal', e.target.value as any)}>
            <option value="job">job</option>
            <option value="open-source">open-source</option>
            <option value="branding">branding</option>
          </select>
        </label>

        <label>
          Tone
          <select value={inputs.tone} onChange={(e) => update('tone', e.target.value as any)}>
            <option value="minimal">minimal</option>
            <option value="confident">confident</option>
            <option value="friendly">friendly</option>
            <option value="founder">founder</option>
          </select>
        </label>

        <label>
          Emoji preference
          <select value={inputs.emojiPreference} onChange={(e) => update('emojiPreference', e.target.value as any)}>
            <option value="none">none</option>
            <option value="light">light</option>
            <option value="expressive">expressive</option>
          </select>
        </label>

        <div style={{ marginTop: 10 }}>
          <strong>Sections</strong>
          <div>
            <label><input type="checkbox" checked={inputs.sections.whatIDo} onChange={(e) => updateNestedSection('whatIDo', e.target.checked)} /> What I Do</label>
          </div>
          <div>
            <label><input type="checkbox" checked={inputs.sections.techStack} onChange={(e) => updateNestedSection('techStack', e.target.checked)} /> Tech Stack</label>
          </div>
          <div>
            <label><input type="checkbox" checked={inputs.sections.projects} onChange={(e) => updateNestedSection('projects', e.target.checked)} /> Featured Projects</label>
          </div>
          <div>
            <label><input type="checkbox" checked={inputs.sections.goal} onChange={(e) => updateNestedSection('goal', e.target.checked)} /> Current Goal</label>
          </div>
          <div>
            <label><input type="checkbox" checked={inputs.sections.connect} onChange={(e) => updateNestedSection('connect', e.target.checked)} /> Let’s Connect</label>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={() => generate(inputs)} disabled={loading} style={{ marginRight: 8 }}>Generate README</button>
          <button onClick={handleCopy} style={{ marginRight: 8 }}>Copy Markdown</button>
          <button onClick={handleDownload}>Download README.md</button>
        </div>

        {/* V2.2: GitHub OAuth Connection Panel */}
        <div style={{ marginTop: 20, padding: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 14 }}>GitHub Connection</strong>
            {githubUser ? (
              <>
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  padding: '4px 8px', 
                  background: '#d1fae5', 
                  borderRadius: 4,
                  fontSize: 12,
                  color: '#065f46'
                }}>
                  ✔ Verified: {githubUser.login}
                </span>
                <button 
                  onClick={disconnectGitHub} 
                  style={{ 
                    marginLeft: 'auto', 
                    fontSize: 12, 
                    padding: '4px 10px',
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: 4,
                    color: '#991b1b',
                    cursor: 'pointer'
                  }}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <a 
                  href="/api/auth/github"
                  style={{ 
                    marginLeft: 'auto',
                    display: 'inline-block',
                    padding: '6px 12px',
                    background: '#24292f',
                    color: '#fff',
                    borderRadius: 4,
                    fontSize: 12,
                    textDecoration: 'none'
                  }}
                >
                  Connect GitHub (Read-Only)
                </a>
              </>
            )}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
            {githubUser 
              ? 'Your GitHub account is verified. Inspection uses authenticated requests for better reliability.'
              : 'Used only to verify your profile and improve suggestions. Read-only access, no writes.'
            }
          </div>
          {oauthError && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#b91c1c' }}>
              OAuth error: {oauthError}
              <button 
                onClick={() => setOauthError(null)} 
                style={{ marginLeft: 8, fontSize: 11, cursor: 'pointer' }}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* V2.0: GitHub Suggestions Panel */}
        <div style={{ marginTop: 20, padding: 12, border: '1px solid #ccc', borderRadius: 6, background: '#fafafa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>GitHub Suggestions</strong>
            <button onClick={inspectGitHub} disabled={inspecting} style={{ marginLeft: 'auto' }}>
              {inspecting ? 'Inspecting…' : 'Inspect GitHub Profile'}
            </button>
          </div>
          {inspectError && (
            <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 13 }}>{inspectError}</div>
          )}
          {suggestions.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>📊 GitHub-Based Suggestions</div>
              {suggestions.map((s, i) => (
                <div key={i} style={{ marginBottom: 8, padding: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: s.type === 'warning' ? '#fef3c7' : s.type === 'repo' ? '#dbeafe' : '#d1fae5',
                      color: s.type === 'warning' ? '#92400e' : s.type === 'repo' ? '#1e40af' : '#065f46'
                    }}>
                      {s.type}
                    </span>
                    <span style={{ flex: 1, fontSize: 13 }}>{s.message}</span>
                    {(s.data?.project || s.data?.languages) && (
                      <button onClick={() => applySuggestion(s)} style={{ fontSize: 12 }}>Apply</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* V2.1: Heuristic Recommendations */}
          {heuristicRecs.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', marginBottom: 6 }}>🧠 Smart Recommendations</div>
              {heuristicRecs.map((rec, i) => (
                <div key={i} style={{ marginBottom: 8, padding: 8, background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: rec.recommendationType === 'warning' ? '#fef3c7' : rec.recommendationType === 'tone' ? '#fce7f3' : '#ddd6fe',
                      color: rec.recommendationType === 'warning' ? '#92400e' : rec.recommendationType === 'tone' ? '#9d174d' : '#5b21b6'
                    }}>
                      {rec.recommendationType}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{rec.message}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{rec.explanation}</div>
                    </div>
                    {rec.suggestedAction && (
                      <button onClick={() => applyHeuristicRecommendation(rec)} style={{ fontSize: 12 }}>Apply</button>
                    )}
                    {!rec.suggestedAction && (
                      <button onClick={() => applyHeuristicRecommendation(rec)} style={{ fontSize: 12, opacity: 0.7 }}>Dismiss</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {suggestions.length === 0 && !inspecting && !inspectError && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
              Click "Inspect GitHub Profile" to get suggestions based on your public repos.
            </div>
          )}
        </div>

        {/* V3: Publish to GitHub Section */}
        <div style={{ marginTop: 20, padding: 12, border: '2px solid #fbbf24', borderRadius: 6, background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <strong style={{ fontSize: 14, color: '#92400e' }}>⚠️ Publish to GitHub</strong>
          </div>
          
          <div style={{ fontSize: 12, color: '#78716c', marginBottom: 12 }}>
            This will commit your README to <code style={{ background: '#fef3c7', padding: '1px 4px', borderRadius: 2 }}>
              {githubUser?.login || inputs.username}/{githubUser?.login || inputs.username}/README.md
            </code>
          </div>

          {/* No write access - show upgrade button */}
          {(!githubUser || !githubUser.hasWriteAccess) && (
            <div>
              <div style={{ fontSize: 12, color: '#b45309', marginBottom: 8 }}>
                Write access required. This permission is used only to commit your profile README when you explicitly approve.
              </div>
              <a 
                href="/api/auth/github?scope=write"
                style={{ 
                  display: 'inline-block',
                  padding: '8px 16px',
                  background: '#f59e0b',
                  color: '#fff',
                  borderRadius: 4,
                  fontSize: 13,
                  textDecoration: 'none',
                  fontWeight: 500
                }}
              >
                Grant Write Access
              </a>
            </div>
          )}

          {/* Has write access - show commit flow */}
          {githubUser?.hasWriteAccess && (
            <div>
              {/* Idle state */}
              {commitState.step === 'idle' && (
                <button 
                  onClick={startCommitFlow}
                  style={{ 
                    padding: '8px 16px',
                    background: '#f59e0b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Start Commit Flow
                </button>
              )}

              {/* Checking state */}
              {commitState.step === 'checking' && (
                <div style={{ fontSize: 13, color: '#78716c' }}>Checking repository...</div>
              )}

              {/* No repo exists */}
              {commitState.step === 'no-repo' && (
                <div>
                  <div style={{ fontSize: 13, color: '#b45309', marginBottom: 8 }}>
                    Repository <code>{githubUser.login}/{githubUser.login}</code> does not exist.
                    <br />
                    <span style={{ fontSize: 12 }}>GitHub shows your profile README from a repo with your username.</span>
                  </div>
                  <button 
                    onClick={createProfileRepo}
                    style={{ 
                      padding: '8px 16px',
                      background: '#f59e0b',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 13,
                      cursor: 'pointer',
                      marginRight: 8
                    }}
                  >
                    Create Repository
                  </button>
                  <button 
                    onClick={cancelCommitFlow}
                    style={{ 
                      padding: '8px 16px',
                      background: '#e5e7eb',
                      color: '#374151',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Preview state - show diff */}
              {commitState.step === 'preview' && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>
                    📋 Diff Preview (Old → New)
                  </div>
                  <div style={{ 
                    maxHeight: 200, 
                    overflow: 'auto', 
                    background: '#1f2937', 
                    color: '#e5e7eb',
                    padding: 12, 
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: 'ui-monospace, monospace',
                    marginBottom: 12
                  }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {generateDiff(commitState.currentReadme, markdown)}
                    </pre>
                  </div>
                  
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={commitConfirmed}
                      onChange={(e) => setCommitConfirmed(e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <span style={{ fontSize: 12, color: '#78716c' }}>
                      I understand this will update my GitHub profile README at{' '}
                      <code style={{ background: '#fef3c7', padding: '1px 4px', borderRadius: 2 }}>
                        github.com/{githubUser.login}/{githubUser.login}
                      </code>
                    </span>
                  </label>

                  <button 
                    onClick={executeCommit}
                    disabled={!commitConfirmed}
                    style={{ 
                      padding: '8px 16px',
                      background: commitConfirmed ? '#16a34a' : '#9ca3af',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: commitConfirmed ? 'pointer' : 'not-allowed',
                      marginRight: 8
                    }}
                  >
                    Commit to GitHub
                  </button>
                  <button 
                    onClick={cancelCommitFlow}
                    style={{ 
                      padding: '8px 16px',
                      background: '#e5e7eb',
                      color: '#374151',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Committing state */}
              {commitState.step === 'committing' && (
                <div style={{ fontSize: 13, color: '#78716c' }}>Committing to GitHub...</div>
              )}

              {/* Success state */}
              {commitState.step === 'success' && (
                <div>
                  <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 8 }}>
                    ✅ Successfully committed!
                  </div>
                  {commitState.commitUrl && (
                    <a 
                      href={commitState.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: '#2563eb' }}
                    >
                      View commit on GitHub →
                    </a>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <button 
                      onClick={cancelCommitFlow}
                      style={{ 
                        padding: '6px 12px',
                        background: '#e5e7eb',
                        color: '#374151',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Error state */}
              {commitState.step === 'error' && (
                <div>
                  <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 8 }}>
                    ❌ Error: {commitState.error}
                  </div>
                  <button 
                    onClick={cancelCommitFlow}
                    style={{ 
                      padding: '6px 12px',
                      background: '#e5e7eb',
                      color: '#374151',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ width: '56%', padding: 20, overflow: 'auto', background: '#0b1220', color: '#e6f0ff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Live Preview</h2>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{loading ? 'Generating…' : 'Ready'}</div>
        </div>

        <div style={{ marginTop: 12, background: '#071024', padding: 16, borderRadius: 8 }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#dbeafe' }}>{markdown}</pre>
        </div>
      </div>
    </div>
  )
}
