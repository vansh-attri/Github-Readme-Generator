"use client"

import React, { useEffect, useState, useRef } from 'react'
import type { ReadmeInputs } from '../types'

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
