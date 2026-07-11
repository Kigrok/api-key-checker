import { requestUrl } from 'obsidian';

// ============================================================
// Types
// ============================================================

/** Stored API key entry with provider association. */
export interface APIKey {
  /** Unique identifier: `provider:key` */
  id: string;
  /** Provider name (must match PROVIDERS constant) */
  provider: string;
  /** Raw API key string */
  key: string;
}

/** Result of a provider key validation check. */
export interface CheckResult {
  /** Unique identifier: `provider:key` */
  id: string;
  /** Provider name */
  provider: string;
  /** Check outcome */
  status: 'Valid' | 'Invalid' | 'Error' | 'No balance';
  /** Human-readable detail (reset time, error message, etc.) */
  details: string;
}

// ============================================================
// Constants
// ============================================================

/** All supported AI provider names. */
export const PROVIDERS: readonly string[] = [
  'OpenAI', 'Anthropic', 'Google', 'Groq', 'Grok',
  'FreeModel', 'Aerolink', 'OpenRouter', 'Kimchi', 'OpenCode Zen',
  'Xiaomi MiMo', 'Amazon Bedrock', 'Z.ai', 'InferAll',
  'Inception', 'Fireworks', 'Abliteration', 'Anyapi', 'Auriko',
  'v0', 'Featherless',
] as const;

/** Union type of all supported provider names. */
export type Provider = typeof PROVIDERS[number];

/** Zero-padded month strings for date formatting. */
const MONTHS: readonly string[] = ['01','02','03','04','05','06','07','08','09','10','11','12'];

// ============================================================
// HTTP Helpers
// ============================================================

/** HTTP response with status code and body text. */
interface HttpResponse {
  status: number;
  text: string;
}

/** A single structured error detail (Google-style quota/retry metadata). */
interface ErrorDetail {
  '@type'?: string;
  retryDelay?: string;
  violations?: { quotaId?: string }[];
}

/** Structured error object carried under `error` by some providers. */
interface ErrorObject {
  message?: string;
  details?: ErrorDetail[];
}

/** Loosely-typed shape of the JSON error bodies providers return. */
interface ErrorBody {
  error?: string | ErrorObject;
  message?: string;
  Output?: { __type?: string };
}

/** Parses a JSON error body, returning null on invalid JSON. */
function parseJson(text: string): ErrorBody | null {
  try {
    return JSON.parse(text) as ErrorBody;
  } catch {
    return null;
  }
}

/** Extracts a human-readable message from a provider error body. */
function errMessage(b: ErrorBody | null): string {
  if (!b) return '';
  if (typeof b.error === 'string') return b.error;
  if (b.error?.message) return b.error.message;
  if (b.message) return b.message;
  return '';
}

/** Returns the structured error object (with `details`) if present. */
function errObject(b: ErrorBody | null): ErrorObject | null {
  return b && typeof b.error === 'object' ? b.error : null;
}

/**
 * Sends an HTTPS POST request via Obsidian's `requestUrl`.
 * `throw: false` keeps the response body available on non-2xx statuses,
 * which the per-provider checkers need to tell "invalid" from "no balance".
 */
async function httpsPost(url: string, headers: Record<string, string>, body: string): Promise<HttpResponse> {
  const res = await requestUrl({ url, method: 'POST', headers, body, throw: false });
  return { status: res.status, text: res.text };
}

/**
 * Sends a GET request via Obsidian's `requestUrl`.
 * Extracts HTTP status from error messages on non-2xx responses.
 */
async function safeGet(url: string, headers: Record<string, string>): Promise<HttpResponse> {
  try {
    const res = await requestUrl({ url, headers });
    return { status: res.status, text: res.text };
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    const m: RegExpMatchArray | null = message.match(/status (\d{3})/);
    if (m) return { status: parseInt(m[1]), text: '' };
    throw e;
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Parses a human-readable reset time string (e.g. "today at 5:20 PM (UTC+8)")
 * and converts it to the user's local 24h format.
 * Returns original string if format is unrecognized.
 */
function parseResetTime(raw: string): string {
  const m: RegExpMatchArray | null = raw.match(/(today|tomorrow|(\d{4})-(\d{2})-(\d{2}))\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?\s*\(UTC([+-]\d+)\)/i);
  if (!m) return raw;
  const [, dayWord, y, mo, d, hStr, min, ampm, tzStr]: (string | undefined)[] = m;
  let tz: number = parseInt(tzStr || '0');
  let hour: number = parseInt(hStr || '0');
  const minute: number = parseInt(min || '0');
  if (ampm) {
    const up: string = ampm.toUpperCase();
    if (up === 'PM' && hour < 12) hour += 12;
    if (up === 'AM' && hour === 12) hour = 0;
  }
  const now: Date = new Date();
  let target: Date;
  if (dayWord?.toLowerCase() === 'today') {
    target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour - tz, minute));
  } else if (dayWord?.toLowerCase() === 'tomorrow') {
    target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, hour - tz, minute));
  } else {
    target = new Date(Date.UTC(parseInt(y || '0'), parseInt(mo || '1') - 1, parseInt(d || '1'), hour - tz, minute));
  }
  const hh: string = String(target.getHours()).padStart(2, '0');
  const mm: string = String(target.getMinutes()).padStart(2, '0');
  const today: Date = new Date();
  const isToday: boolean = target.toDateString() === today.toDateString();
  if (isToday) return hh + ':' + mm;
  return MONTHS[target.getMonth()] + '.' + String(target.getDate()).padStart(2, '0') + ' ' + hh + ':' + mm;
}

/**
 * Formats an ISO 8601 timestamp to local 24h display.
 * Returns original string if invalid.
 */
function formatISOReset(iso: string): string {
  const reset: Date = new Date(iso);
  if (isNaN(reset.getTime())) return iso;
  const now: Date = new Date();
  const hh: string = String(reset.getHours()).padStart(2, '0');
  const mm: string = String(reset.getMinutes()).padStart(2, '0');
  if (reset.toDateString() === now.toDateString()) return hh + ':' + mm;
  return MONTHS[reset.getMonth()] + '.' + String(reset.getDate()).padStart(2, '0') + ' ' + hh + ':' + mm;
}

// ============================================================
// Result Helpers
// ============================================================

/** Creates a successful check result. */
function ok(id: string, provider: string): CheckResult {
  return { id, provider, status: 'Valid', details: 'OK' };
}

/** Creates an invalid key check result. */
function invalid(id: string, provider: string, details: string = 'Invalid key'): CheckResult {
  return { id, provider, status: 'Invalid', details };
}

/** Creates a rate-limited / out-of-credits check result. */
function noBalance(id: string, provider: string, details: string = ''): CheckResult {
  return { id, provider, status: 'No balance', details };
}

/** Creates a network/server error check result. */
export function error(id: string, provider: string, details: string = 'Network error'): CheckResult {
  return { id, provider, status: 'Error', details };
}

/** Creates an HTTP error check result with status code. */
function httpError(id: string, provider: string, status: number): CheckResult {
  return { id, provider, status: 'Error', details: 'HTTP ' + status };
}

/**
 * Sends a chat completion request to an OpenAI-compatible API.
 * Used by providers that use the chat completions endpoint for validation.
 */
function chatPost(url: string, key: string, model: string, body: Record<string, unknown> = {}): Promise<HttpResponse> {
  return httpsPost(url, {
    'Authorization': 'Bearer ' + key,
    'content-type': 'application/json',
  }, JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }], ...body }));
}

// ============================================================
// Provider Checkers
// ============================================================

/**
 * Registry mapping provider names to their checker functions.
 * Each checker takes a unique ID and raw key, returns a CheckResult.
 */
const CHECKERS: Record<string, (id: string, key: string) => Promise<CheckResult>> = {
  OpenAI: (id: string, key: string): Promise<CheckResult> => checkSimpleGet(id, 'OpenAI', 'https://api.openai.com/v1/models', { 'Authorization': 'Bearer ' + key }),
  Anthropic: (id: string, key: string): Promise<CheckResult> => checkSimpleGet(id, 'Anthropic', 'https://api.anthropic.com/v1/models', { 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
  Groq: (id: string, key: string): Promise<CheckResult> => checkSimpleGet(id, 'Groq', 'https://api.groq.com/openai/v1/models', { 'Authorization': 'Bearer ' + key }),
  InferAll: (id: string, key: string): Promise<CheckResult> => checkSimpleGet(id, 'InferAll', 'https://api.inferall.ai/v1/models', { 'Authorization': 'Bearer ' + key }),
  'Xiaomi MiMo': (id: string, key: string): Promise<CheckResult> => checkSimpleGet(id, 'Xiaomi MiMo', 'https://api.xiaomimimo.com/v1/models', { 'Authorization': 'Bearer ' + key }),

  Google: checkGoogle,
  FreeModel: checkFreeModel,
  Aerolink: checkAerolink,
  OpenRouter: checkOpenRouter,
  Kimchi: checkKimchi,
  'OpenCode Zen': checkOpenCodeZen,
  'Amazon Bedrock': checkAmazonBedrock,
  Grok: checkGrok,
  'Z.ai': checkZai,
  Inception: checkInception,
  Fireworks: checkFireworks,
  Abliteration: checkAbliteration,
  Anyapi: checkAnyapi,
  Auriko: checkAuriko,
  v0: checkV0,
  Featherless: checkFeatherless,
};

/**
 * Simple GET-based checker for providers where listing models confirms key validity.
 */
async function checkSimpleGet(id: string, provider: string, url: string, headers: Record<string, string>): Promise<CheckResult> {
  try {
    const res: HttpResponse = await safeGet(url, headers);
    if (res.status === 200) return ok(id, provider);
    if (res.status === 401) return invalid(id, provider);
    return httpError(id, provider, res.status);
  } catch {
    return error(id, provider);
  }
}

/** Checks Google Gemini API key with daily quota detection. */
async function checkGoogle(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await safeGet('https://generativelanguage.googleapis.com/v1/models?key=' + key, {});
    if (res.status === 400 || res.status === 403) return invalid(id, 'Google');
    if (res.status !== 200) return httpError(id, 'Google', res.status);

    const probe: HttpResponse = await httpsPost(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
      { 'content-type': 'application/json' },
      JSON.stringify({ contents: [{ parts: [{ text: '1' }] }] })
    );
    if (probe.status === 200) return ok(id, 'Google');
    if (probe.status === 429) {
      const details: ErrorDetail[] = errObject(parseJson(probe.text))?.details ?? [];
      const quotas: string[] = (details.find((d) => d['@type']?.includes('QuotaFailure'))?.violations ?? [])
        .map((v) => v.quotaId)
        .filter((q): q is string => Boolean(q));
      if (quotas.some((q) => q.includes('PerDay'))) {
        const now: Date = new Date();
        const ptNow: Date = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
        const reset: Date = new Date(ptNow); reset.setHours(24, 0, 0, 0);
        const resetLocal: Date = new Date(reset.getTime() - (ptNow.getTime() - now.getTime()));
        const hh: string = String(resetLocal.getHours()).padStart(2, '0');
        const mm: string = String(resetLocal.getMinutes()).padStart(2, '0');
        const isToday: boolean = resetLocal.toDateString() === now.toDateString();
        return noBalance(id, 'Google', isToday ? hh + ':' + mm : MONTHS[resetLocal.getMonth()] + '.' + String(resetLocal.getDate()).padStart(2, '0') + ' ' + hh + ':' + mm);
      }
      const retry: string = details.find((d) => d['@type']?.includes('RetryInfo'))?.retryDelay ?? '';
      return noBalance(id, 'Google', retry);
    }
    return ok(id, 'Google');
  } catch { return error(id, 'Google'); }
}

/** Checks FreeModel key. Parses reset time from 402 "will reset on..." messages. */
async function checkFreeModel(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await httpsPost('https://cc.freemodel.dev/v1/messages', {
      'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json',
    }, JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }));
    if (res.status === 200) return ok(id, 'FreeModel');
    if (res.status === 401 || res.status === 402) {
      const msg: string = errMessage(parseJson(res.text));
      const low: string = msg.toLowerCase();
      if (low.includes('insufficient balance') || low.includes('usage limit') || low.includes('rate limit') || low.includes('limit reached') || res.status === 402) {
        const m: RegExpMatchArray | null = msg.match(/(?:will\s+)?reset(?:s)?\s+on\s+(.+)/i);
        return noBalance(id, 'FreeModel', m ? parseResetTime(m[1]) : '');
      }
      return invalid(id, 'FreeModel');
    }
    return httpError(id, 'FreeModel', res.status);
  } catch { return error(id, 'FreeModel'); }
}

/** Checks Aerolink key via Anthropic messages API. */
async function checkAerolink(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await httpsPost('https://capi.aerolink.lat/v1/messages', {
      'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json',
    }, JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }));
    if (res.status === 200) return ok(id, 'Aerolink');
    if (res.status === 401) {
      const msg: string = errMessage(parseJson(res.text));
      if (msg.includes('unavailable') || msg.includes('balance') || msg.includes('No active free usage') || msg.includes('Add balance')) {
        return noBalance(id, 'Aerolink');
      }
      return invalid(id, 'Aerolink');
    }
    return httpError(id, 'Aerolink', res.status);
  } catch { return error(id, 'Aerolink'); }
}

/** Checks OpenRouter key. Detects insufficient credits on 401/402. */
async function checkOpenRouter(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await chatPost('https://openrouter.ai/api/v1/chat/completions', key, 'openai/gpt-3.5-turbo');
    if (res.status === 200) return ok(id, 'OpenRouter');
    if (res.status === 401) {
      if (errMessage(parseJson(res.text)).includes('Insufficient credits')) return noBalance(id, 'OpenRouter');
      return invalid(id, 'OpenRouter');
    }
    if (res.status === 402) return noBalance(id, 'OpenRouter');
    return httpError(id, 'OpenRouter', res.status);
  } catch { return error(id, 'OpenRouter'); }
}

/**
 * Checks Kimchi key. Uses max_tokens: 500 to trigger rate limit detection.
 * Parses rate limit info from both JSON and raw text responses.
 */
async function checkKimchi(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await httpsPost('https://llm.kimchi.dev/anthropic/v1/messages', {
      'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json',
    }, JSON.stringify({ model: 'kimi-k2.7', max_tokens: 500, messages: [{ role: 'user', content: 'hi' }] }));

    const checkRateLimit = (text: string): CheckResult | null => {
      const errMsg: string = errMessage(parseJson(text));
      if (errMsg) {
        const m: RegExpMatchArray | null = errMsg.match(/rate limited until (\S+)/i);
        if (m) return noBalance(id, 'Kimchi', formatISOReset(m[1]));
        if (errMsg.includes('rate') || errMsg.includes('limit')) return noBalance(id, 'Kimchi');
      }
      const m: RegExpMatchArray | null = text.match(/rate limited until (\S+)/i);
      if (m) return noBalance(id, 'Kimchi', formatISOReset(m[1]));
      if (text.toLowerCase().includes('rate limit')) return noBalance(id, 'Kimchi');
      return null;
    };

    if (res.status === 200) {
      const r: CheckResult | null = checkRateLimit(res.text);
      if (r) return r;
      if (!res.text || res.text.trim() === '') return noBalance(id, 'Kimchi');
      return ok(id, 'Kimchi');
    }
    if (res.status === 401) return invalid(id, 'Kimchi');
    if (res.status === 429) {
      const r: CheckResult | null = checkRateLimit(res.text);
      if (r) return r;
      return noBalance(id, 'Kimchi');
    }
    return httpError(id, 'Kimchi', res.status);
  } catch { return error(id, 'Kimchi'); }
}

/** Checks OpenCode Zen key using a free model. */
async function checkOpenCodeZen(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await chatPost('https://opencode.ai/zen/v1/chat/completions', key, 'deepseek-v4-flash-free');
    if (res.status === 200) return ok(id, 'OpenCode Zen');
    if (res.status === 401) return invalid(id, 'OpenCode Zen');
    return httpError(id, 'OpenCode Zen', res.status);
  } catch { return error(id, 'OpenCode Zen'); }
}

/**
 * Checks Amazon Bedrock key via model invoke.
 * Key format: `region.payload` (base64 Mantle API key).
 * Detects proxy limitations (UnknownOperationException).
 */
async function checkAmazonBedrock(id: string, key: string): Promise<CheckResult> {
  try {
    const dotIdx: number = key.indexOf('.');
    if (dotIdx === -1) return invalid(id, 'Amazon Bedrock', 'Invalid key format');
    const region: string = key.slice(0, dotIdx);
    const payload: string = key.slice(dotIdx + 1);
    const res: HttpResponse = await httpsPost('https://bedrock.' + region + '.amazonaws.com/model/amazon.nova-lite-v1:0/invoke', {
      'Authorization': 'Bearer ' + payload, 'content-type': 'application/json',
    }, JSON.stringify({ messages: [{ role: 'user', content: [{ text: 'hi' }] }], maxTokens: 1 }));
    if (res.status === 200) {
      const outputType: string = parseJson(res.text)?.Output?.__type ?? '';
      if (outputType.includes('UnknownOperationException') || outputType.includes('Validation')) {
        return invalid(id, 'Amazon Bedrock', 'No invoke access');
      }
      return ok(id, 'Amazon Bedrock');
    }
    if (res.status === 403) return invalid(id, 'Amazon Bedrock');
    return httpError(id, 'Amazon Bedrock', res.status);
  } catch { return error(id, 'Amazon Bedrock'); }
}

/** Checks Grok key. Detects insufficient credits on 403. */
async function checkGrok(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await chatPost('https://api.x.ai/v1/chat/completions', key, 'grok-3');
    if (res.status === 200) return ok(id, 'Grok');
    if (res.status === 403) {
      const msg: string = errMessage(parseJson(res.text));
      if (msg.includes('credits') || msg.includes('balance') || msg.includes('purchase')) return noBalance(id, 'Grok');
      return invalid(id, 'Grok');
    }
    if (res.status === 401) return invalid(id, 'Grok');
    return httpError(id, 'Grok', res.status);
  } catch { return error(id, 'Grok'); }
}

/** Checks Z.ai key. Detects model_access_denied on 403. */
async function checkZai(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await chatPost('https://z.ai/api/v1/chat/completions', key, 'glm-5');
    if (res.status === 200) return ok(id, 'Z.ai');
    if (res.status === 403) {
      const msg: string = errMessage(parseJson(res.text));
      if (msg.includes('No permission') || msg.includes('model_access_denied')) return invalid(id, 'Z.ai', 'No model access');
      return invalid(id, 'Z.ai');
    }
    if (res.status === 401) return invalid(id, 'Z.ai');
    return httpError(id, 'Z.ai', res.status);
  } catch { return error(id, 'Z.ai'); }
}

/** Checks Inception key. Detects deprecated model on 403. */
async function checkInception(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await chatPost('https://api.inceptionlabs.ai/v1/chat/completions', key, 'mercury-2');
    if (res.status === 200) return ok(id, 'Inception');
    if (res.status === 401) return invalid(id, 'Inception');
    if (res.status === 403) return invalid(id, 'Inception', 'Model not available');
    return httpError(id, 'Inception', res.status);
  } catch { return error(id, 'Inception'); }
}

/** Checks Fireworks key. Detects insufficient balance on 402. */
async function checkFireworks(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await chatPost('https://api.fireworks.ai/inference/v1/chat/completions', key, 'accounts/fireworks/models/deepseek-v4-pro');
    if (res.status === 200) return ok(id, 'Fireworks');
    if (res.status === 401) return invalid(id, 'Fireworks');
    if (res.status === 402) return noBalance(id, 'Fireworks');
    return httpError(id, 'Fireworks', res.status);
  } catch { return error(id, 'Fireworks'); }
}

/** Checks Abliteration key. Only supports `abliterated-model`. */
async function checkAbliteration(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await chatPost('https://api.abliteration.ai/v1/chat/completions', key, 'abliterated-model');
    if (res.status === 200) return ok(id, 'Abliteration');
    if (res.status === 401) return invalid(id, 'Abliteration');
    return httpError(id, 'Abliteration', res.status);
  } catch { return error(id, 'Abliteration'); }
}

/** Checks Anyapi key using a free model. Detects rate limiting on 429. */
async function checkAnyapi(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await chatPost('https://api.anyapi.ai/v1/chat/completions', key, 'meta-llama/llama-3.3-70b-instruct:free');
    if (res.status === 200) return ok(id, 'Anyapi');
    if (res.status === 429) return noBalance(id, 'Anyapi');
    if (res.status === 401) return invalid(id, 'Anyapi');
    return httpError(id, 'Anyapi', res.status);
  } catch { return error(id, 'Anyapi'); }
}

/** Checks Auriko key. Detects insufficient balance on 429. */
async function checkAuriko(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await chatPost('https://api.auriko.ai/v1/chat/completions', key, 'gpt-3.5-turbo');
    if (res.status === 200) return ok(id, 'Auriko');
    if (res.status === 429) return noBalance(id, 'Auriko');
    if (res.status === 401) return invalid(id, 'Auriko');
    return httpError(id, 'Auriko', res.status);
  } catch { return error(id, 'Auriko'); }
}

/** Checks v0 key. Detects API not available on 404. */
async function checkV0(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await safeGet('https://api.v0.dev/v1/chats', { 'Authorization': 'Bearer ' + key });
    if (res.status === 200) return ok(id, 'v0');
    if (res.status === 401) return invalid(id, 'v0');
    if (res.status === 404) return invalid(id, 'v0', 'API not available');
    return httpError(id, 'v0', res.status);
  } catch { return error(id, 'v0'); }
}

/** Checks Featherless key. Detects subscription/gated model issues on 403. */
async function checkFeatherless(id: string, key: string): Promise<CheckResult> {
  try {
    const res: HttpResponse = await chatPost('https://api.featherless.ai/v1/chat/completions', key, 'mistralai/Mistral-7B-Instruct-v0.3');
    if (res.status === 200) return ok(id, 'Featherless');
    if (res.status === 403) {
      const msg: string = errMessage(parseJson(res.text));
      if (msg.includes('subscription') || msg.includes('API access') || msg.includes('upgrade')) return noBalance(id, 'Featherless', 'No API access');
      if (msg.includes('gated')) return noBalance(id, 'Featherless', 'Model gated');
      return invalid(id, 'Featherless');
    }
    if (res.status === 401) return invalid(id, 'Featherless');
    return httpError(id, 'Featherless', res.status);
  } catch { return error(id, 'Featherless'); }
}

// ============================================================
// Main Dispatcher
// ============================================================

/**
 * Validates an API key against the specified provider.
 * Routes to the appropriate checker function via the CHECKERS registry.
 */
export async function checkKey(provider: string, key: string): Promise<CheckResult> {
  const id: string = provider + ':' + key;
  const checker: ((id: string, key: string) => Promise<CheckResult>) | undefined = CHECKERS[provider];
  if (checker) return checker(id, key);
  return error(id, provider, 'Unknown provider');
}
