import { App, ButtonComponent, ItemView, Modal, Plugin, Setting, WorkspaceLeaf, Notice } from 'obsidian';
import { APIKey, CheckResult, PROVIDERS, checkKey, error as checkError } from './checker';

// ============================================================
// Constants
// ============================================================

/** View type identifier for the checker sidebar panel. */
const VIEW_TYPE: string = 'api-key-checker-view';

/** Favicon URLs for each provider (Google favicon service). */
const FAVICONS: Record<string, string> = {
  'OpenAI': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://openai.com&size=32',
  'Anthropic': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://anthropic.com&size=32',
  'Google': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://google.com&size=32',
  'Groq': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://groq.com&size=32',
  'Grok': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://x.ai&size=32',
  'FreeModel': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://freemodel.dev&size=32',
  'Aerolink': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://aerolink.lat&size=32',
  'OpenRouter': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://openrouter.ai&size=32',
  'Kimchi': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://kimchi.dev&size=32',
  'OpenCode Zen': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://opencode.ai&size=32',
  'Xiaomi MiMo': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://mimo.mi.com&size=32',
  'Amazon Bedrock': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://aws.amazon.com&size=32',
  'Z.ai': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://z.ai&size=32',
  'InferAll': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://inferall.ai&size=32',
  'Inception': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://inceptionlabs.ai&size=32',
  'Fireworks': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://fireworks.ai&size=32',
  'Abliteration': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://abliteration.ai&size=32',
  'Anyapi': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://anyapi.ai&size=32',
  'Auriko': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://auriko.ai&size=32',
  'v0': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://v0.dev&size=32',
  'Featherless': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://featherless.ai&size=32',
};

/** Sort order for statuses (lower = higher priority). */
const STATUS_ORDER: Record<string, number> = { Valid: 0, 'No balance': 1, Invalid: 2, Error: 3 };

/** CSS modifier class carrying the color for each status (see styles.css). */
const STATUS_CLASS: Record<string, string> = {
  Valid: 'akc-status--valid',
  'No balance': 'akc-status--limit',
  Error: 'akc-status--error',
  Invalid: 'akc-status--invalid',
};

/** Short display labels for each status. */
const STATUS_LABELS: Record<string, string> = {
  Valid: 'OK', 'No balance': 'LIMIT', Error: 'ERROR', Invalid: 'INVALID',
};

// ============================================================
// Settings
// ============================================================

/** Plugin settings structure (persisted via loadData/saveData). */
interface Settings {
  /** List of stored API keys */
  keys: APIKey[];
}

/** Default settings with empty key list. */
const DEFAULT_SETTINGS: Settings = { keys: [] };

// ============================================================
// Helpers
// ============================================================

/** Masks an API key showing first 3 and last 3 characters. */
function maskKey(key: string): string {
  return key.slice(0, 3) + '***' + key.slice(-3);
}

/** Formats a Date to "HH:MM" (today) or "DD.MM HH:MM" (other days). */
function formatTime(d: Date): string {
  const hh: string = String(d.getHours()).padStart(2, '0');
  const mm: string = String(d.getMinutes()).padStart(2, '0');
  const isToday: boolean = d.toDateString() === new Date().toDateString();
  return isToday ? hh + ':' + mm : d.getDate() + '.' + (d.getMonth() + 1) + ' ' + hh + ':' + mm;
}

/** Copies text to clipboard. Returns false on failure. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Plugin
// ============================================================

/** Main plugin class. Manages settings, view registration, and cleanup. */
export default class APIKeyCheckerPlugin extends Plugin {
  /** Plugin settings (persisted) */
  settings: Settings = DEFAULT_SETTINGS;
  /** Cache of check results by key ID */
  cache: Map<string, CheckResult> = new Map();
  /** Timestamp of last check per provider */
  lastCheck: Map<string, number> = new Map();

  /** Registers view, ribbon icon, and command on plugin load. */
  async onload(): Promise<void> {
    await this.loadSettings();
    this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new CheckerView(leaf, this));
    this.addRibbonIcon('key', 'AI API key checker', () => { void this.activateView(); });

    this.addCommand({
      id: 'check-api-keys',
      name: 'Open panel',
      callback: () => { void this.activateView(); },
    });
  }

  /** Clears in-memory caches on plugin unload. */
  onunload(): void {
    this.cache.clear();
    this.lastCheck.clear();
  }

  /** Loads settings from Obsidian data store. Migrates from old config.json if needed. */
  async loadSettings(): Promise<void> {
    const saved = await this.loadData() as Partial<Settings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved ?? {});
    if (this.settings.keys.length === 0) {
      try {
        const adapter = this.app.vault.adapter;
        if (await adapter.exists('config.json')) {
          const old = JSON.parse(await adapter.read('config.json')) as Partial<Settings>;
          if (Array.isArray(old.keys) && old.keys.length > 0) {
            this.settings = { keys: old.keys };
            await this.saveSettings();
          }
        }
      } catch {
        // Ignore malformed/missing legacy config; fall back to defaults.
      }
    }
  }

  /** Saves settings to Obsidian data store. */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Opens or reveals the checker sidebar view. */
  async activateView(): Promise<void> {
    const existing: WorkspaceLeaf[] = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length) { void this.app.workspace.revealLeaf(existing[0]); return; }
    await this.app.workspace.getLeaf(true).setViewState({ type: VIEW_TYPE, active: true });
  }
}

// ============================================================
// View
// ============================================================

/** Sidebar view that displays API key check results. */
class CheckerView extends ItemView {
  /** Reference to the parent plugin */
  plugin: APIKeyCheckerPlugin;
  /** Render token for preventing stale renders */
  renderToken: number = 0;

  constructor(leaf: WorkspaceLeaf, plugin: APIKeyCheckerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return 'AI API key checker'; }
  getIcon(): string { return 'key'; }

  /** Initializes the view container and triggers first render. */
  async onOpen(): Promise<void> {
    const container: HTMLElement = this.containerEl.children[1] as HTMLElement;
    container.addClass('api-key-checker-view');
    void this.render(container);
  }

  async onClose(): Promise<void> {}

  /**
   * Main render method. Handles empty state, async key checks, and full UI rebuild.
   * Uses token guard to prevent stale renders from completing.
   */
  async render(container: HTMLElement, force: boolean = false, newKeys?: APIKey[]): Promise<void> {
    const token: number = ++this.renderToken;

    if (this.plugin.settings.keys.length === 0) {
      container.empty();
      this.renderHeader(container);
      container.createEl('p', { text: 'No keys added yet', cls: 'akc-empty' });
      return;
    }

    if (force) this.plugin.cache.clear();
    const { results, checkedProviders } = await this.checkKeys(container, newKeys);

    if (token !== this.renderToken) return;
    container.empty();
    this.renderHeader(container);

    const items = this.buildItems(results, checkedProviders);
    const sortedGroups = this.groupByProvider(items);
    const stats = this.computeStats(items);

    this.renderStats(container, stats);
    this.renderGrid(container, sortedGroups);
  }

  /** Renders the header with title and action buttons. */
  private renderHeader(container: HTMLElement): void {
    const header: HTMLElement = container.createDiv({ cls: 'akc-header' });
    header.createEl('h2', { text: 'AI API key checker' });
    const buttons: HTMLElement = header.createDiv({ cls: 'akc-buttons' });

    new ButtonComponent(buttons).setButtonText('Add key').setCta()
      .onClick(() => new AddKeyModal(this.app, this.plugin, (added: APIKey[]) => { void this.render(container, false, added); }).open());
    new ButtonComponent(buttons).setButtonText('Refresh')
      .onClick(() => { void this.render(container, true); });
  }

  /**
   * Checks all keys (or new keys only) and returns results.
   * Tracks which providers were actually checked for timestamp updates.
   */
  private async checkKeys(container: HTMLElement, newKeys?: APIKey[]): Promise<{ results: CheckResult[]; checkedProviders: Set<string> }> {
    const keys: APIKey[] = this.plugin.settings.keys;
    const checked: Set<string> = new Set<string>();
    const mark = (k: APIKey): void => { checked.add(k.provider); };

    if (newKeys && newKeys.length > 0) {
      const existing: APIKey[] = keys.filter((k: APIKey) => !newKeys.some((n: APIKey) => n.id === k.id));
      const existCached: boolean = existing.every((k: APIKey) => this.plugin.cache.has(k.id));
      const existResults: CheckResult[] = existCached
        ? existing.map((k: APIKey) => this.plugin.cache.get(k.id)!)
        : await Promise.all(existing.map(async (k: APIKey) => { mark(k); const r: CheckResult = await checkKey(k.provider, k.key); this.plugin.cache.set(k.id, r); return r; }));
      container.createEl('p', { text: 'Checking new keys...', cls: 'akc-loading' });
      const newResults: CheckResult[] = await Promise.all(newKeys.map(async (k: APIKey) => { mark(k); const r: CheckResult = await checkKey(k.provider, k.key); this.plugin.cache.set(k.id, r); return r; }));
      const allKeys: APIKey[] = [...existing, ...newKeys];
      const allResults: CheckResult[] = [...existResults, ...newResults];
      return { results: keys.map((k: APIKey) => { const idx: number = allKeys.findIndex((x: APIKey) => x.id === k.id); return idx >= 0 ? allResults[idx] : checkError(k.id, k.provider); }), checkedProviders: checked };
    }
    const cached: boolean = keys.every((k: APIKey) => this.plugin.cache.has(k.id));
    if (cached) return { results: keys.map((k: APIKey) => this.plugin.cache.get(k.id)!), checkedProviders: checked };
    container.createEl('p', { text: 'Checking...', cls: 'akc-loading' });
    const results: CheckResult[] = await Promise.all(keys.map(async (k: APIKey) => { mark(k); const r: CheckResult = await checkKey(k.provider, k.key); this.plugin.cache.set(k.id, r); return r; }));
    return { results, checkedProviders: checked };
  }

  /** Builds sorted items array and updates provider timestamps. */
  private buildItems(results: CheckResult[], checkedProviders: Set<string>): Array<{ key: APIKey; result: CheckResult }> {
    const items: Array<{ key: APIKey; result: CheckResult }> = this.plugin.settings.keys.map((k: APIKey, i: number) => ({ key: k, result: results[i] }));
    items.sort((a, b) => (STATUS_ORDER[a.result.status] ?? 9) - (STATUS_ORDER[b.result.status] ?? 9));
    const now: number = Date.now();
    for (const p of checkedProviders) this.plugin.lastCheck.set(p, now);
    return items;
  }

  /** Groups items by provider, sorted by worst status first. */
  private groupByProvider(items: Array<{ key: APIKey; result: CheckResult }>): [string, Array<{ key: APIKey; result: CheckResult }>][] {
    const groups: Map<string, Array<{ key: APIKey; result: CheckResult }>> = new Map();
    for (const item of items) {
      const g: Array<{ key: APIKey; result: CheckResult }> = groups.get(item.key.provider) || [];
      g.push(item);
      groups.set(item.key.provider, g);
    }
    const worst = (entries: Array<{ key: APIKey; result: CheckResult }>): number => entries.length > 0 ? Math.max(...entries.map((e) => STATUS_ORDER[e.result.status] ?? 9)) : 0;
    return [...groups.entries()].sort((a, b) => worst(b[1]) - worst(a[1]));
  }

  /** Computes aggregate statistics from check results. */
  private computeStats(items: Array<{ key: APIKey; result: CheckResult }>): { total: number; valid: number; limit: number; invalid: number; error: number } {
    return {
      total: items.length,
      valid: items.filter((i) => i.result.status === 'Valid').length,
      limit: items.filter((i) => i.result.status === 'No balance').length,
      invalid: items.filter((i) => i.result.status === 'Invalid').length,
      error: items.filter((i) => i.result.status === 'Error').length,
    };
  }

  /** Renders the stats bar (OK | LIMIT | INVALID | ERROR). */
  private renderStats(container: HTMLElement, stats: { total: number; valid: number; limit: number; invalid: number; error: number }): void {
    const el: HTMLElement = container.createDiv({ cls: 'akc-stats' });
    const items: Array<{ text: string; cls: string }> = [];
    if (stats.valid > 0) items.push({ text: stats.valid + ' OK', cls: 'akc-status--valid' });
    if (stats.limit > 0) items.push({ text: stats.limit + ' LIMIT', cls: 'akc-status--limit' });
    if (stats.invalid > 0) items.push({ text: stats.invalid + ' INVALID', cls: 'akc-status--invalid' });
    if (stats.error > 0) items.push({ text: stats.error + ' ERROR', cls: 'akc-status--error' });
    items.forEach((item: { text: string; cls: string }, i: number) => {
      if (i > 0) el.createSpan({ text: ' | ', cls: 'akc-stats-sep' });
      el.createSpan({ text: item.text, cls: 'akc-stats-item ' + item.cls });
    });
    el.createSpan({ text: ' (' + stats.total + ' total)', cls: 'akc-stats-total' });
  }

  /** Renders the grid of provider sections. */
  private renderGrid(container: HTMLElement, sortedGroups: Array<[string, Array<{ key: APIKey; result: CheckResult }>]>): void {
    const grid: HTMLElement = container.createDiv({ cls: 'akc-grid' });
    for (const [provider, entries] of sortedGroups) {
      this.renderSection(grid, provider, entries, container);
    }
  }

  /**
   * Renders a single provider section with header, key table, collapse/expand, and copy-to-clipboard.
   */
  private renderSection(grid: HTMLElement, provider: string, entries: Array<{ key: APIKey; result: CheckResult }>, container: HTMLElement): void {
    const section: HTMLElement = grid.createDiv({ cls: 'akc-section' });
    const validCount: number = entries.filter((e) => e.result.status === 'Valid').length;

    const header: HTMLElement = section.createDiv({ cls: 'akc-section-header' });
    const arrow: HTMLElement = header.createSpan({ text: '▶', cls: 'akc-arrow' });

    const faviconUrl: string | undefined = FAVICONS[provider];
    if (faviconUrl) header.createEl('img', { cls: 'akc-favicon', attr: { src: faviconUrl, alt: provider, width: '16', height: '16' } });
    header.createSpan({ text: provider, cls: 'akc-section-title' });
    header.createSpan({ text: validCount + '/' + entries.length + ' valid', cls: 'akc-section-count' });

    const lastCheckTime: number | undefined = this.plugin.lastCheck.get(provider);
    if (lastCheckTime) header.createSpan({ text: formatTime(new Date(lastCheckTime)), cls: 'akc-last-check' });

    new ButtonComponent(header).setIcon('refresh-cw').setTooltip('Re-check all ' + provider + ' keys')
      .onClick(async (e: MouseEvent) => { e.stopPropagation(); await this.recheckProvider(provider, entries, container); });

    const table: HTMLTableElement = section.createEl('table', { cls: 'akc-table' });
    const thead: HTMLTableSectionElement = table.createEl('thead');
    thead.createEl('th', { text: 'Key' });
    thead.createEl('th', { text: 'Status' });
    thead.createEl('th', { text: '' });
    const tbody: HTMLTableSectionElement = table.createEl('tbody');

    for (let i: number = 0; i < entries.length; i++) {
      const { key: k, result }: { key: APIKey; result: CheckResult } = entries[i];
      const row: HTMLTableRowElement = tbody.createEl('tr');
      const masked: string = maskKey(k.key);
      row.createEl('td', { text: masked, cls: 'akc-key', attr: { title: k.key } });

      const statusCell: HTMLElement = row.createEl('td');
      const statusCls: string = STATUS_CLASS[result.status] || 'akc-status--invalid';
      const label: string = STATUS_LABELS[result.status] || result.status;
      const hasDetails: boolean = !!(result.details && !['OK', 'Invalid key', 'Network error'].includes(result.details));
      statusCell.createSpan({ text: label, cls: 'akc-status ' + statusCls });
      if (hasDetails) statusCell.createSpan({ text: ' — ' + result.details, cls: 'akc-details ' + statusCls });

      const actions: HTMLElement = row.createEl('td', { cls: 'akc-actions' });
      new ButtonComponent(actions).setIcon('refresh-cw').setTooltip('Re-check')
        .onClick(async () => { this.plugin.cache.delete(k.id); this.plugin.cache.set(k.id, await checkKey(k.provider, k.key)); this.plugin.lastCheck.set(k.provider, Date.now()); void this.render(container); });
      const deleteBtn = new ButtonComponent(actions).setIcon('trash').setTooltip('Delete');
      deleteBtn.buttonEl.addClass('mod-warning');
      deleteBtn.onClick(async () => { this.plugin.settings.keys = this.plugin.settings.keys.filter((x: APIKey) => x.id !== k.id); await this.plugin.saveSettings(); void this.render(container); });
    }

    // Collapse/expand: hide entries beyond the first 3
    const hidden: Array<{ key: APIKey; result: CheckResult }> = entries.slice(3);
    for (const item of hidden) {
      const idx: number = entries.indexOf(item);
      const row: HTMLElement | undefined = tbody.children[idx] as HTMLElement | undefined;
      if (row) row.addClass('akc-hidden');
    }

    if (hidden.length > 0) {
      let expanded: boolean = false;
      header.addEventListener('click', () => {
        expanded = !expanded;
        arrow.textContent = expanded ? '▼' : '▶';
        for (let i: number = 3; i < tbody.children.length; i++) {
          const row: HTMLElement | undefined = tbody.children[i] as HTMLElement | undefined;
          if (row) row.toggleClass('akc-hidden', !expanded);
        }
      });
      header.addClass('akc-clickable');
    } else {
      arrow.textContent = '▼';
    }

    // Click to copy key to clipboard
    for (let i: number = 0; i < entries.length; i++) {
      const k: APIKey = entries[i].key;
      const row: HTMLElement | undefined = tbody.children[i] as HTMLElement | undefined;
      const keyCell: HTMLElement | undefined = row?.children[0] as HTMLElement | undefined;
      if (keyCell) {
        keyCell.addEventListener('click', () => {
          void (async () => {
            const ok: boolean = await copyToClipboard(k.key);
            if (!ok) { new Notice('Failed to copy'); return; }
            keyCell.textContent = 'Copied!';
            window.setTimeout(() => { keyCell.textContent = maskKey(k.key); }, 1000);
          })();
        });
      }
    }
  }

  /** Re-checks all keys for a single provider and updates timestamp. */
  private async recheckProvider(provider: string, entries: Array<{ key: APIKey; result: CheckResult }>, container: HTMLElement): Promise<void> {
    for (const { key: k } of entries) {
      this.plugin.cache.delete(k.id);
      this.plugin.cache.set(k.id, await checkKey(k.provider, k.key));
    }
    this.plugin.lastCheck.set(provider, Date.now());
    void this.render(container);
  }
}

// ============================================================
// Add Key Modal
// ============================================================

/** Modal dialog for adding new API keys with a numbered textarea. */
class AddKeyModal extends Modal {
  /** Reference to the parent plugin */
  plugin: APIKeyCheckerPlugin;
  /** Callback invoked with newly added keys */
  onAdd: (added: APIKey[]) => void;
  /** Currently selected provider */
  provider: string = PROVIDERS[0];

  constructor(app: App, plugin: APIKeyCheckerPlugin, onAdd: (added: APIKey[]) => void) {
    super(app);
    this.plugin = plugin;
    this.onAdd = onAdd;
  }

  /** Renders the modal content: provider dropdown, numbered textarea, and action buttons. */
  onOpen(): void {
    const { contentEl } = this;
    this.setTitle('Add API keys');

    new Setting(contentEl).setName('Provider').addDropdown((dd) => {
      for (const p of [...PROVIDERS].sort()) dd.addOption(p, p);
      dd.setValue(this.provider);
      dd.onChange((v: string) => this.provider = v);
    });

    const wrapper: HTMLElement = contentEl.createDiv({ cls: 'akc-input-wrapper' });
    const lineNumbers: HTMLElement = wrapper.createDiv({ cls: 'akc-line-numbers' });
    lineNumbers.createSpan({ text: '1' });

    const ta: HTMLTextAreaElement = wrapper.createEl('textarea', {
      cls: 'akc-textarea',
      attr: { rows: '8', placeholder: 'One key per line', spellcheck: 'false' },
    });

    const updateLineNumbers = (): void => {
      const count: number = Math.max(ta.value.split('\n').length, 1);
      lineNumbers.empty();
      for (let i: number = 1; i <= count; i++) lineNumbers.createSpan({ text: String(i) });
    };
    ta.addEventListener('input', updateLineNumbers);
    ta.addEventListener('scroll', () => { lineNumbers.scrollTop = ta.scrollTop; });
    updateLineNumbers();

    contentEl.createEl('p', { text: 'Paste multiple keys, one per line', cls: 'akc-hint' });

    new Setting(contentEl)
      .addButton((btn) => {
        btn.setButtonText('Add').setCta();
        btn.onClick(async () => { await this.addKeys(ta.value); });
      })
      .addButton((btn) => { btn.setButtonText('Cancel'); btn.onClick(() => this.close()); });
  }

  /**
   * Parses textarea input, deduplicates against existing keys,
   * adds new entries to settings, and triggers the onAdd callback.
   */
  private async addKeys(text: string): Promise<void> {
    const lines: string[] = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    if (lines.length === 0) return;
    const added: APIKey[] = [];
    for (const key of lines) {
      const id: string = this.provider + ':' + key;
      if (this.plugin.settings.keys.some((k: APIKey) => k.id === id)) continue;
      const entry: APIKey = { id, provider: this.provider, key };
      this.plugin.settings.keys.push(entry);
      added.push(entry);
    }
    if (added.length === 0) return;
    await this.plugin.saveSettings();
    this.close();
    this.onAdd(added);
  }

  /** Cleans up modal content on close. */
  onClose(): void { this.contentEl.empty(); }
}
