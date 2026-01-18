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
