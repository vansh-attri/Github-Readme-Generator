# GitHub Profile README Generator — MVP

This repository contains an MVP (Version 1) of a GitHub Profile README generator web app.

Key constraints and notes:
- Frontend: Next.js (app router). Backend: serverless API route at `/api/generate-readme`.
- README generation happens server-side. The frontend never calls any AI SDK directly.
- If `OPENAI_API_KEY` is set in environment, the server will attempt to call the OpenAI API. If not set, a deterministic local formatter will be used.
- This MVP does NOT implement GitHub OAuth, GitHub API calls, auto commit, user accounts, analytics, or database storage.

Files of interest:
- `app/page.tsx` — main frontend (inputs + live preview + buttons)
- `app/api/generate-readme/route.ts` — server API for generation
- `lib/promptBuilder.ts` — builds the single structured JSON prompt
- `lib/markdownFormatter.ts` — local deterministic markdown generator (fallback)
- `types/index.ts` — shared TypeScript types

Run locally

1. Install dependencies:

```bash
cd /Users/vanshattri/Desktop/Github_readme
npm install
```

2. Run dev server:

```bash
npm run dev
```

3. Open http://localhost:3000

Environment

- To enable OpenAI usage, set `OPENAI_API_KEY` in your environment. Without it, the server will use the local formatter.

Notes

- The generated markdown strictly follows the required README structure and uses a single structured JSON prompt when calling the AI.
- The app intentionally avoids implementing Version 2 features; these will be added later.
