# GitHub Profile README Generator

A web app that helps developers create a personalized GitHub profile README.

## Version History

- **V1 (complete):** Manual inputs → server-side README generation (AI + deterministic fallback)
- **V2.0 (complete):** GitHub-aware suggestions using public GitHub data only

## Features

### V1: Core README Generation
- Guided form for inputs (name, username, career stage, role, tech stack, projects, goal, tone, emoji preference)
- Server-side README generation (frontend never calls AI directly)
- If `OPENAI_API_KEY` is set, uses OpenAI; otherwise uses deterministic local formatter
- Live markdown preview
- Copy / Download buttons

### V2.0: GitHub Suggestions
- **GitHub Inspection API** (`/api/github/inspect`) — fetches public repos only (no auth)
- **Deterministic Repo Ranking** — filters out forks, archived, empty; ranks by stars + recency
- **Rules-Based Suggestions Engine** — generates suggestions (never auto-inserts)
- **Suggestions Panel UI** — preview + Apply button for each suggestion
- User explicitly approves every suggestion before it affects the README

## Key Constraints

- ❌ No GitHub OAuth
- ❌ No authentication
- ❌ No GitHub write access / auto-commit
- ❌ No database or user storage
- ❌ No AI used for GitHub analysis (100% deterministic)
- ✅ App works fully without GitHub input
- ✅ README generation still happens via existing server endpoint

## Files of Interest

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main frontend (inputs, preview, suggestions panel) |
| `app/api/generate-readme/route.ts` | README generation API |
| `app/api/github/inspect/route.ts` | GitHub inspection API (V2.0) |
| `lib/promptBuilder.ts` | Builds structured JSON prompt |
| `lib/markdownFormatter.ts` | Deterministic markdown generator (fallback) |
| `lib/githubInspector.ts` | Fetches public GitHub repos (V2.0) |
| `lib/repoRanker.ts` | Filters and ranks repos deterministically (V2.0) |
| `lib/suggestionsEngine.ts` | Rules-based suggestions generator (V2.0) |
| `types/index.ts` | Shared TypeScript types |

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Run dev server:

```bash
npm run dev
```

3. Open http://localhost:3000

## Environment

- To enable OpenAI usage, set `OPENAI_API_KEY` in your environment. Without it, the server will use the local formatter.

## Notes

- GitHub inspection fetches only: repo name, description, primary language, star count, last updated, fork/archived/size flags
- GitHub inspection does NOT fetch: private repos, followers, commits, issues, pull requests
- Suggestions are read-only previews; user must click "Apply" to add data to inputs
- README output never changes automatically
