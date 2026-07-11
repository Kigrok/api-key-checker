<p align="center">
  <img src="ai_api_key_checker_banner.png" alt="AI API Key Checker" width="100%">
</p>

<h1 align="center">AI API Key Checker</h1>

<p align="center">
  Validate API keys and detect rate limits for <b>21 AI providers</b> — right inside Obsidian, in one click.
</p>

<p align="center">
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=TypeScript&logoColor=FFF&style=flat-square"></a>
  <a href="https://obsidian.md/"><img alt="Obsidian" src="https://img.shields.io/badge/-Obsidian-7C3AED?style=flat-square&logo=obsidian&logoColor=white"></a>
  <a href="https://github.com/Kigrok/api-key-checker/releases"><img alt="Version" src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square"></a>
  <a href="https://github.com/Kigrok/api-key-checker/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/Kigrok/api-key-checker/total?style=flat-square&color=brightgreen"></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-desktop%20%26%20mobile-8a8a9a?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-3fb950?style=flat-square">
</p>

---

## ✨ Features

- **Instant validation** — every key is checked against the real provider API, not a regex.
- **Rate-limit & balance detection** — tells apart a *bad key* from a *good key with no quota*, and shows exactly when the limit resets: `LIMIT — 17:20` or `LIMIT — 07.11 15:00`.
- **Bulk check** — paste 50+ keys at once, get results in seconds.
- **Smart sorting** — broken keys float to the top so you spot problems first.
- **Click to copy** — click a masked key to copy it; hover to reveal the full value.
- **Stats bar** — `12 OK | 3 LIMIT | 2 INVALID (17 total)` at a glance.
- **Last-check time** — see when each provider was last verified.

---

## 📦 Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest).
2. Drop them into `YourVault/.obsidian/plugins/api-key-checker/`:
   ```
   YourVault/.obsidian/plugins/api-key-checker/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```
3. In Obsidian: **Settings → Community plugins → Reload**, then enable **AI API Key Checker**.

### Via BRAT

Add this repository in the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin to auto-update from releases.

---

## 🚀 Usage

1. Click the **key** icon in the left ribbon (or run the command **AI API Key Checker: Open panel**).
2. Hit **Add key**, pick a provider, paste one or more keys (one per line).
3. Read the results — grouped by provider, worst status first.

---

## 🔌 Supported providers

<details>
<summary><b>21 providers</b> — click to expand</summary>

| Provider | Check Method | Notes |
|---|---|---|
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://openai.com&size=32" width="16"> OpenAI | `/v1/models` | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://anthropic.com&size=32" width="16"> Anthropic | `/v1/models` | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://google.com&size=32" width="16"> Google Gemini | Model list + Gemini probe | Detects daily quota reset |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://groq.com&size=32" width="16"> Groq | `/v1/models` | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://x.ai&size=32" width="16"> Grok | Chat completion (grok-3) | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://freemodel.dev&size=32" width="16"> FreeModel | Anthropic messages API | Parses reset time from 402 |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://aerolink.lat&size=32" width="16"> Aerolink | Anthropic messages API | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://openrouter.ai&size=32" width="16"> OpenRouter | Chat completion | Shows balance |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://kimchi.dev&size=32" width="16"> Kimchi | Anthropic messages API | Detects rate limit via error body |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://opencode.ai&size=32" width="16"> OpenCode Zen | Chat completion (free model) | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://mimo.mi.com&size=32" width="16"> Xiaomi MiMo | `/v1/models` | Bearer auth |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://aws.amazon.com&size=32" width="16"> Amazon Bedrock | Model invoke (nova-lite) | Detects proxy limitations |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://z.ai&size=32" width="16"> Z.ai | Chat completion (glm-5) | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://inferall.ai&size=32" width="16"> InferAll | `/v1/models` | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://inceptionlabs.ai&size=32" width="16"> Inception | Chat completion (mercury-2) | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://fireworks.ai&size=32" width="16"> Fireworks | Chat completion (deepseek-v4-pro) | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://abliteration.ai&size=32" width="16"> Abliteration | Chat completion (abliterated-model) | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://anyapi.ai&size=32" width="16"> Anyapi | Chat completion (free model) | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://auriko.ai&size=32" width="16"> Auriko | Chat completion (gpt-3.5-turbo) | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://v0.dev&size=32" width="16"> v0 | `/v1/chats` | |
| <img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://featherless.ai&size=32" width="16"> Featherless | Chat completion (Mistral-7B) | |

</details>

---

## 🎯 Status legend

| Status | | Meaning |
|:---:|---|---|
| `OK` | 🟢 | Key is valid and working |
| `LIMIT` | 🟡 | Key works but is rate-limited or out of credits (shows reset time) |
| `INVALID` | 🔴 | Key rejected — check for typos or expiry |
| `ERROR` | 🟠 | Network issue or the provider is down |

---

## 🔒 Privacy

Your keys never leave your machine except to reach the provider you are validating.
There is no telemetry, no analytics, and no third-party server in between.
Keys are stored locally in `.obsidian/plugins/api-key-checker/data.json` — treat that file as a secret and never commit it.
The **click-to-copy** feature writes the selected key to your system clipboard only when you click it; the plugin never reads clipboard content.

---

## 🛠️ Development

```bash
npm install       # install dev dependencies
npm run dev       # watch-mode build (esbuild)
npm run build     # type-check + minified production bundle -> main.js
npm run lint      # ESLint (typescript-eslint + eslint-plugin-obsidianmd)
```

Source lives in `src/` (`main.ts` = UI/plugin lifecycle, `checker.ts` = validation engine). Obsidian only loads the bundled `main.js`, so rebuild after every change. Adding a provider is a five-step change — see `CLAUDE.md`.

---

## 📄 License

[MIT](LICENSE) © VenvStore
