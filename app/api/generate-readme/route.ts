import { NextResponse } from 'next/server'
import type { ReadmeInputs } from '../../../types'
import { buildStructuredPrompt } from '../../../lib/promptBuilder'
import { formatReadme } from '../../../lib/markdownFormatter'

// Note: backend-only generation. If OPENAI_API_KEY is present, call OpenAI
// Otherwise fallback to a deterministic local generator (formatReadme).

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const inputs: ReadmeInputs = body.inputs

    // Build the single structured prompt JSON (kept for audit / future AI use)
    const structured = buildStructuredPrompt(inputs)

    // If OPENAI_API_KEY is provided, attempt to call OpenAI Chat API
    const key = process.env.OPENAI_API_KEY || ''
    if (key) {
      // Lazy import to avoid requiring SDK when not used
      const { OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey: key })

      const system = `You are a README generator. Input (request) will be a single JSON string. Produce Markdown ONLY (no explanations). Follow rules in request.meta.rules. Output must not include any commentary.`

      const promptMessage = structured

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: promptMessage }
        ],
        max_tokens: 800
      })

      const markdown = response.choices?.[0]?.message?.content || ''
      return NextResponse.json({ markdown })
    }

    // Fallback local generation (no external AI). Uses same input structure.
    const markdown = formatReadme(inputs)
    return NextResponse.json({ markdown, note: 'local' })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
