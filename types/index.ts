export type CareerStage = 'student' | 'professional' | 'founder' | 'open-source'

export type EmojiPreference = 'none' | 'light' | 'expressive'

export type Tone = 'minimal' | 'confident' | 'friendly' | 'founder'

export interface ReadmeInputs {
  name: string
  username: string
  careerStage: CareerStage
  role: string
  techStack: string[]
  featuredProjects: { name: string; impact: string }[]
  profileGoal: 'job' | 'open-source' | 'branding'
  tone: Tone
  emojiPreference: EmojiPreference
  sections: {
    whatIDo: boolean
    techStack: boolean
    projects: boolean
    goal: boolean
    connect: boolean
  }
}

// V2.0: GitHub Inspection Types

export interface GitHubRepoRaw {
  name: string
  description: string | null
  language: string | null
  stargazers_count: number
  updated_at: string
  fork: boolean
  archived: boolean
  size: number // 0 means empty
}

export interface GitHubRepoNormalized {
  name: string
  description: string
  language: string
  stars: number
  lastUpdated: string
}

export interface GitHubInspectResponse {
  username: string
  repos: GitHubRepoNormalized[]
  languages: string[]
  suggestions: Suggestion[]
}

export interface Suggestion {
  type: 'repo' | 'section' | 'warning'
  message: string
  data?: {
    repos?: GitHubRepoNormalized[]
    languages?: string[]
    project?: { name: string; impact: string }
  }
}

// V2.1: Heuristic Recommendations Types

export interface HeuristicRecommendation {
  recommendationType: 'section' | 'tone' | 'warning'
  message: string
  explanation: string
  suggestedAction?: {
    type: 'enable' | 'disable' | 'change'
    target: 'projects' | 'techStack' | 'goal' | 'tone' | 'whatIDo' | 'connect'
    value?: any
  }
}

export interface HeuristicsInput {
  userInputs: ReadmeInputs
  githubData: {
    repoCount: number
    hasRecentActivity: boolean
    primaryLanguages: string[]
    topRepos: GitHubRepoNormalized[]
    totalStars: number
    forkRatio: number // percentage of repos that are forks (from raw data context)
  } | null
}
