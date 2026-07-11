# AGENTS.md

Obsidian plugin — "AI API Key Checker". Validates API keys for 20+ AI providers via their REST APIs.

## Repo structure

- `src/checker.ts` — provider checkers, HTTP helpers, types. Each provider has a `check*()` function returning `CheckResult`
- `src/main.ts` — plugin entry, sidebar UI, settings persistence (Obsidian `data.json`; one-time migration from a legacy `config.json` in the vault root)
- `main.js` — esbuild bundle (gitignored; shipped via GitHub release). Obsidian loads this directly.
- `styles.css` — sidebar styling
- `manifest.json` — Obsidian plugin manifest (id: `api-key-checker`, minAppVersion `1.7.2`)
- `README.md` — user-facing documentation

## Build

```bash
npm install
npm run dev      # watch build
npm run build    # tsc type-check + production bundle -> main.js
npm run lint     # typescript-eslint + eslint-plugin-obsidianmd
```

Lint bar: 0 errors. Only accepted warnings are the plugin's proper name flagged by `obsidianmd/ui/sentence-case`.

## Adding a new provider

1. Add a `check<Name>()` async function in `src/checker.ts` — follow the existing pattern
2. Add the provider name to the `PROVIDERS` array
3. Add a checker entry to the `CHECKERS` record (maps provider name → function)
4. Add a favicon URL to `FAVICONS` in `src/main.ts`
5. Rebuild `main.js`

## Conventions

- TypeScript, strict null checks — uses Obsidian API types (`import from 'obsidian'`). No `any`; parse provider error bodies via `parseJson()` + typed `ErrorBody`/`errMessage()`/`errObject()` helpers
- HTTP: `httpsPost()` (Obsidian `requestUrl` with `throw: false`) for providers where the response body matters; `safeGet()` (Obsidian `requestUrl`) for simple GET checks. No Node APIs — plugin runs on desktop and mobile
- Provider checkers use helper functions: `ok()`, `invalid()`, `noBalance()`, `error()`, `httpError()`
- `chatPost()` helper for OpenAI-compatible chat completion endpoints
- Status values: `Valid`, `Invalid`, `No balance`, `Error`
- Settings stored via Obsidian `loadData()`/`saveData()` (`data.json` in plugin dir)
- Status colors are CSS modifier classes (`akc-status--valid/--limit/--invalid/--error`), not inline styles; all classes prefixed `akc-`
- All UI text in English
