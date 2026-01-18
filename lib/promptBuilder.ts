import { ReadmeInputs } from '../types'

export function buildStructuredPrompt(inputs: ReadmeInputs) {
  // Single structured JSON prompt as required by MVP
  const prompt = {
    meta: {
      version: 'mvp-v1',
      rules: {
        output: 'markdown_only',
        max_section_chars: {
          short_bio: 280,
          what_i_do: 200,
          tech_stack: 400,
          projects: 400,
          goal: 160,
          connect: 180
        },
        avoid: ['fake metrics', 'unverifiable claims', 'cliches', 'buzzwords']
      }
    },
    inputs
  }

  return JSON.stringify(prompt)
}
