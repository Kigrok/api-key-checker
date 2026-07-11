# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Obsidian community plugin **"AI API Key Checker"** (`manifest.json` id: `api-key-checker`). It validates API keys and detects rate limits / spent balances for 21 AI providers, rendering results in a sidebar panel. Works on desktop and mobile (`isDesktopOnly: false`) — all HTTP goes through Obsidian's `requestUrl`, no Node APIs.

This directory sits inside an Obsidian vault (`.obsidian/plugins/checker/`). The vault root has its own unrelated `CLAUDE.md` for Markdown-note editing — ignore it here; this is a software project.

## Build

Standard Obsidian-plugin toolchain (modeled on the sibling `library` plugin). Obsidian only ever loads `main.js`, never the `.ts` files, so you must rebuild after editing `src/`:

```bash
npm install       # once — installs esbuild, typescript, eslint, eslint-plugin-obsidianmd
npm run dev       # watch-mode esbuild (inline sourcemap)
npm run build     # tsc -noEmit type-check + minified production bundle -> main.js
npm run lint      # ESLint: typescript-eslint (type-checked) + obsidianmd guideline rules
npm run version   # bump manifest.json + versions.json (via version-bump.mjs)
```

esbuild follows the `import './checker'` from `main.ts`, so one build bundles both source files. `main.js` and `data.json` are gitignored — `main.js` ships via GitHub release (`.github/workflows/release.yml`), not the repo. There is no way to run the plugin outside Obsidian — to test, rebuild and reload the plugin in Obsidian (toggle it off/on under Community plugins, or reload the app).

The lint bar is **0 errors**; the only accepted warnings are the plugin's proper name ("AI API Key Checker") used as the ribbon tooltip / view title / panel heading, which the `obsidianmd/ui/sentence-case` rule flags but is legitimately exempt.

## Architecture

Two source files with a clean split — **`checker.ts` is pure logic with no Obsidian UI, `main.ts` is all UI/plugin lifecycle.**

### `src/checker.ts` — validation engine

- **`checkKey(provider, key)`** is the single public entry point. It builds `id = "provider:key"` and dispatches through the **`CHECKERS` registry** (provider name → async checker function). Unknown providers return an `Error` result.
- Every checker returns a **`CheckResult`** with `status: 'Valid' | 'Invalid' | 'Error' | 'No balance'`. Construct these only via the helpers `ok()` / `invalid()` / `noBalance()` / `error()` / `httpError()` — don't build the object literal inline.
- **Two HTTP paths, chosen per provider:**
  - `httpsPost()` — Obsidian `requestUrl` with `throw: false`, used when the **response body matters** (parsing reset times, quota IDs, credit messages). Returns `{ status, text }`.
  - `safeGet()` — Obsidian's `requestUrl`, for simple GET checks where the **status code alone** decides validity. It reverse-engineers the status from `requestUrl`'s thrown error message when non-2xx.
  - `chatPost()` wraps `httpsPost` for the many OpenAI-compatible `/chat/completions` endpoints (sends `max_tokens: 1`, a one-word "hi").
- **The value of this plugin is the per-provider quirks**, not the plumbing. Each provider signals "valid but out of balance/rate-limited" differently — a 402, a 403 with a "credits" substring, a 429 with a `QuotaFailure` detail block, a 200 with an empty body (Kimchi), etc. The distinction between `Invalid` (bad key) and `No balance` (good key, no quota) lives in these branches. When touching a checker, preserve its exact status-code + body-substring logic.
- `checkSimpleGet()` is the shared implementation for the trivial "GET /models, 200 = valid, 401 = invalid" providers (OpenAI, Anthropic, Groq, InferAll, Xiaomi MiMo).
- `parseResetTime()` / `formatISOReset()` normalize provider reset timestamps (human strings, ISO, per-day PT quota rollover) into local `HH:MM` or `MM.DD HH:MM` display strings.

### `src/main.ts` — plugin + sidebar view

- `APIKeyCheckerPlugin` (default export) registers a single `ItemView` (`VIEW_TYPE = 'api-key-checker-view'`), a ribbon key icon, and an "Open API Key Checker" command.
- **`CheckerView.render()` fully rebuilds the DOM each call** (empty + recreate). A monotonic `renderToken` guards against stale async renders completing out of order — increment-and-compare is intentional, keep it.
- **Result caching:** `plugin.cache` (keyed by `APIKey.id`) memoizes check results so re-renders don't re-hit provider APIs; `render(container, force=true)` clears it to force a live re-check. `plugin.lastCheck` tracks per-provider "last verified" timestamps for display. Both are in-memory only (cleared on `onunload`).
- Adding a key only re-checks the *new* keys, reusing cached results for existing ones (see `checkKeys()`).
- UI concerns: results are grouped by provider (worst status first), sorted within group by `STATUS_ORDER`, sections past 3 keys collapse, masked keys click-to-copy, `FAVICONS` maps provider → favicon URL, `STATUS_LABELS`/`STATUS_COLORS` map the internal status enum to the `OK`/`LIMIT`/`INVALID`/`ERROR` display.
- **Settings persistence:** `loadData()`/`saveData()` → `data.json` in this plugin dir. `loadSettings()` performs a **one-time migration** from a legacy `config.json` in the vault root when no keys exist yet — leave this path intact.

## Adding a provider

All five steps are required or the provider silently won't work:

1. `src/checker.ts`: write `check<Name>(id, key)` following the closest existing checker's status-handling shape.
2. Register it in the `CHECKERS` record (or reuse `checkSimpleGet` for a plain models-list check).
3. Add the name to the `PROVIDERS` array (drives the Add-Key dropdown).
4. `src/main.ts`: add a `FAVICONS` entry (Google favicon-service URL, matching the existing rows).
5. Rebuild with `npm run build` (and `npm run lint` — 0 errors expected).

## Conventions

- Match the existing checkers' explicit `if (status === …)` ladders — validity logic is deliberately per-provider, not abstracted.
- CSS classes are prefixed `akc-`; all rendering uses Obsidian's `createEl`/`ButtonComponent`, not raw innerHTML.
- All user-facing UI text is English.
- Bump `version` in both `manifest.json` and `versions.json` (maps plugin version → min Obsidian version) when releasing.
- `AGENTS.md` is a compact mirror of this doc for other agents — keep it in sync when these rules change.
