import { ReadmeInputs } from '../types'

const MAX = {
  short_bio: 280,
  what_i_do: 200,
  tech_stack: 400,
  projects: 400,
  goal: 160,
  connect: 180
}

function truncate(s: string, n: number) {
  if (!s) return ''
  if (s.length <= n) return s
  return s.slice(0, n - 1).trim() + '…'
}

export function formatReadme(inputs: ReadmeInputs) {
  const { name, role, techStack, featuredProjects, profileGoal, emojiPreference, sections } = inputs

  const emoji = (e: string) => (emojiPreference === 'none' ? '' : ` ${e}`)

  const lines: string[] = []

  // Title
  const titleName = name || inputs.username || 'Your Name'
  lines.push(`# 👋 Hi, I'm ${titleName}`)
  lines.push('')

  // Short bio: concise, human-sounding. Build from inputs but avoid assumptions.
  const bioParts: string[] = []
  if (sections.whatIDo && role) {
    bioParts.push(`${role} focused on ${techStack.slice(0, 3).join(', ') || 'building software'}`)
  } else if (role) {
    bioParts.push(role)
  }
  bioParts.push(`Currently exploring projects and collaborations${emoji('🌱')}`)

  const shortBio = truncate(bioParts.join('. '), MAX.short_bio)
  if (shortBio) {
    lines.push(shortBio)
    lines.push('')
  }

  // What I Do
  if (sections.whatIDo) {
    const what = truncate(`${role} — I build and ship practical tools that solve developer problems.`, MAX.what_i_do)
    lines.push('## 🚀 What I Do')
    lines.push(what)
    lines.push('')
  }

  // Tech Stack
  if (sections.techStack) {
    lines.push('## 🧠 Tech Stack')
    if (techStack && techStack.length) {
      // group lightly: languages, frameworks, infra (best-effort)
      lines.push(techStack.map((t) => `- ${t}`).join('\n'))
    } else {
      lines.push('- Not listed')
    }
    lines.push('')
  }

  // Featured Projects
  if (sections.projects) {
    lines.push('## 📌 Featured Projects')
    if (featuredProjects && featuredProjects.length) {
      featuredProjects.forEach((p) => {
        const name = p.name || 'Project'
        const impact = truncate(p.impact || 'Short one-line description of impact', MAX.projects)
        lines.push(`- ${name} — ${impact}`)
      })
    } else {
      lines.push('- No projects listed')
    }
    lines.push('')
  }

  // Current Goal
  if (sections.goal) {
    lines.push('## 🎯 Current Goal')
    const goalMap: Record<string, string> = {
      job: 'Looking for roles where I can build and improve developer tools.',
      'open-source': 'Contributing to open-source and collaborating with maintainers.',
      branding: 'Sharpening my public portfolio and writing about projects.'
    }
    lines.push(truncate(goalMap[profileGoal] || 'Exploring meaningful work.', MAX.goal))
    lines.push('')
  }

  // Connect
  if (sections.connect) {
    lines.push('## 🤝 Let’s Connect')
    lines.push('- GitHub: `https://github.com/' + inputs.username + '`')
    lines.push('- Email: (add your email)')
    lines.push('')
  }

  return lines.join('\n')
}
