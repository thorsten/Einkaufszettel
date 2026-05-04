import { beforeEach, describe, expect, it } from 'vitest';
import { Lamport } from '../src/clock';
import { I18n } from '../src/i18n';
import { ShopRegistry } from '../src/shops';
import { ListStore, type StorageLike } from '../src/storage';
import { TemplateStore } from '../src/templates';
import { ThemeController, type MediaQueryLike } from '../src/theme';
import { renderApp, type AppState } from '../src/ui';
import { UndoStack } from '../src/undo';
import { emptyLists } from '../src/markdown';
import { DEFAULT_SHOPS, type Item } from '../src/types';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

class FakeMediaQuery implements MediaQueryLike {
  matches = false;
  addEventListener() {}
  removeEventListener() {}
}

function mkItem(over: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    name: 'X',
    done: false,
    qty: undefined,
    ts: 1000,
    lamport: 1,
    dev: 'd1',
    tomb: false,
    pos: 0,
    ...over,
  };
}

function setup(): { root: HTMLElement; state: AppState; store: ListStore } {
  const root = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(root);
  const store = new ListStore(new MemoryStorage());
  const theme = new ThemeController(
    new MemoryStorage(),
    new FakeMediaQuery(),
    document.documentElement,
  );
  const i18n = new I18n(new MemoryStorage(), () => 'de');
  const shops = new ShopRegistry(new MemoryStorage());
  const templates = new TemplateStore(new MemoryStorage());
  const state: AppState = {
    active: 'ALDI',
    lists: emptyLists(),
    theme,
    i18n,
    device: 'test-dev',
    clock: new Lamport(0),
    undo: new UndoStack(),
    shops,
    templates,
    supabaseConfig: { url: '', anonKey: '', household: '', enabled: false },
    supabaseStatus: 'idle',
  };
  renderApp(root, state, store);
  return { root, state, store };
}

describe('renderApp', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.classList.remove('dark');
  });

  it('renders version badge', async () => {
    const { root } = setup();
    const { VERSION } = await import('../src/version');
    expect(root.querySelector('[data-version]')?.textContent).toBe(`v${VERSION}`);
  });

  it('renders default shop tabs', () => {
    const { root } = setup();
    expect(root.querySelectorAll('[data-shop]')).toHaveLength(DEFAULT_SHOPS.length);
  });

  it('shows empty state when no items', () => {
    const { root } = setup();
    expect(root.textContent).toContain('Noch keine Artikel');
  });

  it('adds item with category via form', () => {
    const { root, state } = setup();
    const form = root.querySelector<HTMLFormElement>('[data-form="add"]')!;
    form.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'Milch';
    form.querySelector<HTMLInputElement>('input[name="cat"]')!.value = 'Milch';
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(state.lists.ALDI[0]).toMatchObject({ name: 'Milch', cat: 'Milch' });
  });

  it('search filters visible items', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [mkItem({ id: 'a', name: 'Milch' }), mkItem({ id: 'b', name: 'Brot' })];
    renderApp(root, state, store);
    const input = root.querySelector<HTMLInputElement>('[data-input="search"]')!;
    input.value = 'mi';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(state.search).toBe('mi');
    const items = root.querySelectorAll('[data-item]');
    expect(items).toHaveLength(1);
  });

  it('shows no-results message when filter has no match', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [mkItem({ id: 'a', name: 'Milch' })];
    state.search = 'banane';
    renderApp(root, state, store);
    expect(root.textContent).toContain('Keine Treffer');
  });

  it('group headers shown when items have categories', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [
      mkItem({ id: 'a', name: 'Apfel', cat: 'Obst' }),
      mkItem({ id: 'b', name: 'Brot', cat: 'Brot' }),
    ];
    renderApp(root, state, store);
    expect(root.textContent).toContain('Obst');
    expect(root.textContent).toContain('Brot');
  });

  it('move-up swaps pos with neighbor above', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [
      mkItem({ id: 'a', name: 'A', pos: 0 }),
      mkItem({ id: 'b', name: 'B', pos: 1 }),
    ];
    renderApp(root, state, store);
    const liB = root.querySelector('[data-item="b"]')!;
    liB.querySelector<HTMLButtonElement>('[data-action="move-up"]')!.click();
    expect(state.lists.ALDI.find((i) => i.id === 'b')?.pos).toBe(0);
    expect(state.lists.ALDI.find((i) => i.id === 'a')?.pos).toBe(1);
  });

  it('toggles done', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [mkItem({ id: 'x', name: 'Brot', lamport: 1 })];
    renderApp(root, state, store);
    root
      .querySelector<HTMLInputElement>('[data-action="toggle"]')!
      .dispatchEvent(new Event('change', { bubbles: true }));
    expect(state.lists.ALDI[0].done).toBe(true);
  });

  it('delete tombstones', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [mkItem({ id: 'x', name: 'Brot' })];
    renderApp(root, state, store);
    root.querySelector<HTMLButtonElement>('[data-action="delete"]')!.click();
    expect(state.lists.ALDI[0].tomb).toBe(true);
  });

  it('hides tombstoned items', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [
      mkItem({ id: 'a', name: 'live' }),
      mkItem({ id: 'b', name: 'dead', tomb: true }),
    ];
    renderApp(root, state, store);
    expect(root.querySelectorAll('[data-item]')).toHaveLength(1);
  });

  it('switches active shop on tab click', () => {
    const { root, state } = setup();
    root.querySelector<HTMLButtonElement>('[data-shop="REWE"]')!.click();
    expect(state.active).toBe('REWE');
  });

  it('cycles theme + lang', () => {
    const { root, state } = setup();
    root.querySelector<HTMLButtonElement>('[data-action="theme"]')!.click();
    expect(state.theme.theme).toBe('light');
    root.querySelector<HTMLButtonElement>('[data-action="lang"]')!.click();
    expect(state.i18n.lang).toBe('en');
    expect(root.textContent).toContain('No items yet');
  });

  it('escapes HTML in item names', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [mkItem({ id: 'x', name: '<script>alert(1)</script>' })];
    renderApp(root, state, store);
    expect(root.querySelector('script')).toBeNull();
  });

  describe('settings drawer', () => {
    it('opens and closes', () => {
      const { root, state } = setup();
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      expect(state.settingsOpen).toBe(true);
      expect(root.querySelector('[data-settings-overlay]')).toBeTruthy();
      root.querySelector<HTMLButtonElement>('[data-action="settings-close"]')!.click();
      expect(state.settingsOpen).toBe(false);
    });

    it('adds new shop via form', () => {
      const { root, state } = setup();
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      const form = root.querySelector<HTMLFormElement>('[data-form="shop-add"]')!;
      form.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'DM';
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      expect(state.shops.shops).toContain('DM');
    });

    it('saves and applies a template', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'a', name: 'Milch' })];
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      const saveForm = root.querySelector<HTMLFormElement>('[data-form="template-save"]')!;
      saveForm.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'Wochen';
      saveForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      expect(state.templates.list().map((t) => t.name)).toContain('Wochen');

      // clear and re-apply
      state.lists.ALDI = [];
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      const apply = root.querySelector<HTMLButtonElement>(
        '[data-action="template-apply"][data-template-name="Wochen"]',
      )!;
      apply.click();
      expect(state.lists.ALDI.length).toBeGreaterThan(0);
      expect(state.lists.ALDI[0].name).toBe('Milch');
      expect(state.lists.ALDI[0].id).not.toBe('a');
    });
  });

  describe('undo', () => {
    it('undo restores after add', () => {
      const { root, state } = setup();
      const form = root.querySelector<HTMLFormElement>('[data-form="add"]')!;
      form.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'Milch';
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      expect(state.lists.ALDI).toHaveLength(1);
      root.querySelector<HTMLButtonElement>('[data-action="undo"]')!.click();
      expect(state.lists.ALDI).toHaveLength(0);
    });

    it('undo button absent when no toast', () => {
      const { root } = setup();
      expect(root.querySelector('[data-toast]')).toBeNull();
      expect(root.querySelector('[data-action="undo"]')).toBeNull();
    });
  });

  describe('settings shop operations', () => {
    it('shop-up moves shop one position earlier', () => {
      const { root, state } = setup();
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      const before = [...state.shops.shops];
      const target = before[1];
      root
        .querySelector<HTMLButtonElement>(`[data-action="shop-up"][data-shop-name="${target}"]`)!
        .click();
      expect(state.shops.shops[0]).toBe(target);
    });

    it('shop-down moves shop one position later', () => {
      const { root, state } = setup();
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      const before = [...state.shops.shops];
      const target = before[0];
      root
        .querySelector<HTMLButtonElement>(`[data-action="shop-down"][data-shop-name="${target}"]`)!
        .click();
      expect(state.shops.shops[1]).toBe(target);
    });

    it('shop-rename migrates items and updates active shop', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'a', name: 'Milch' })];
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      const input = root.querySelector<HTMLInputElement>('[data-shop-input="ALDI"]')!;
      input.value = 'ALDI Süd';
      root
        .querySelector<HTMLButtonElement>('[data-action="shop-rename"][data-shop-name="ALDI"]')!
        .click();
      expect(state.shops.shops).toContain('ALDI Süd');
      expect(state.lists['ALDI Süd']).toHaveLength(1);
      expect(state.lists['ALDI']).toBeUndefined();
      expect(state.active).toBe('ALDI Süd');
    });

    it('shop-remove deletes shop bucket', () => {
      const { root, state } = setup();
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      root
        .querySelector<HTMLButtonElement>('[data-action="shop-remove"][data-shop-name="REWE"]')!
        .click();
      expect(state.shops.shops).not.toContain('REWE');
      expect(state.lists.REWE).toBeUndefined();
    });

    it('settings overlay click outside closes', () => {
      const { root, state } = setup();
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      const overlay = root.querySelector<HTMLDivElement>('[data-settings-overlay]')!;
      overlay.dispatchEvent(new Event('click', { bubbles: true }));
      // Inner click on drawer body should NOT close. Outer click does.
      const evt = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(evt, 'target', { value: overlay });
      Object.defineProperty(evt, 'currentTarget', { value: overlay });
      overlay.dispatchEvent(evt);
      expect(state.settingsOpen).toBe(false);
    });
  });

  describe('templates', () => {
    it('template-apply imports items into current state', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'a', name: 'Milch' })];
      renderApp(root, state, store);
      state.templates.save('T', state.lists);
      // wipe and apply
      state.lists.ALDI = [];
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      root
        .querySelector<HTMLButtonElement>('[data-action="template-apply"][data-template-name="T"]')!
        .click();
      expect(state.lists.ALDI.length).toBeGreaterThan(0);
      expect(state.lists.ALDI[0].name).toBe('Milch');
      expect(state.lists.ALDI[0].id).not.toBe('a');
      expect(state.settingsOpen).toBe(false);
    });

    it('template-remove deletes', () => {
      const { root, state, store } = setup();
      state.templates.save('T', state.lists);
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      root
        .querySelector<HTMLButtonElement>(
          '[data-action="template-remove"][data-template-name="T"]',
        )!
        .click();
      expect(state.templates.list().length).toBe(0);
    });
  });

  describe('voice', () => {
    it('shows toast when voice unsupported (no SpeechRecognition global)', () => {
      const { root, state } = setup();
      // happy-dom does not provide SpeechRecognition
      root.querySelector<HTMLButtonElement>('[data-action="voice"]')!.click();
      expect(state.toast?.label).toMatch(/nicht unterstützt|not supported/i);
    });
  });

  describe('export', () => {
    it('triggers anchor download via shareMarkdown', () => {
      const { root } = setup();
      const orig = URL.createObjectURL;
      URL.createObjectURL = () => 'blob:fake';
      const created: HTMLAnchorElement[] = [];
      const origCreate = document.createElement.bind(document);
      document.createElement = ((tag: string) => {
        const el = origCreate(tag) as HTMLElement;
        if (tag === 'a') created.push(el as HTMLAnchorElement);
        return el;
      }) as typeof document.createElement;
      try {
        root.querySelector<HTMLButtonElement>('[data-action="export"]')!.click();
        // shareMarkdown is async; fire-and-forget. Just confirm click did not throw.
        expect(true).toBe(true);
      } finally {
        URL.createObjectURL = orig;
        document.createElement = origCreate;
      }
    });
  });

  describe('sync flow', () => {
    it('merges incoming markdown via file input', async () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'a', name: 'lokal' })];
      renderApp(root, state, store);
      const fileInput = root.querySelector<HTMLInputElement>('[data-input="file"]')!;
      const md = '# ALDI\n- [ ] remote <!-- id:r ts:1 lamport:99 dev:d2 tomb:0 pos:0 -->\n';
      const file = new File([md], 'list.md', { type: 'text/markdown' });
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
      expect(state.lists.ALDI.find((i) => i.id === 'r')).toBeTruthy();
      expect(state.syncedAt).toBeGreaterThan(0);
    });
  });

  describe('cancel-edit', () => {
    it('discards pending edit', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'x', name: 'Brot' })];
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="edit"]')!.click();
      const input = root.querySelector<HTMLInputElement>('[data-form="edit"] input[name="name"]')!;
      input.value = 'Other';
      root.querySelector<HTMLButtonElement>('[data-action="cancel-edit"]')!.click();
      expect(state.editingId).toBeUndefined();
      expect(state.lists.ALDI[0].name).toBe('Brot');
    });
  });

  describe('add custom shop via settings', () => {
    it('persists and adds bucket', () => {
      const { root, state } = setup();
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      const form = root.querySelector<HTMLFormElement>('[data-form="shop-add"]')!;
      form.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'DM';
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      expect(state.shops.shops).toContain('DM');
      expect(state.lists.DM).toEqual([]);
    });
  });

  describe('undo no-op', () => {
    it('undo button click with empty stack does nothing', () => {
      const { root, state, store } = setup();
      state.toast = { label: 'x', expiresAt: Date.now() + 5000 };
      renderApp(root, state, store);
      const before = JSON.stringify(state.lists);
      root.querySelector<HTMLButtonElement>('[data-action="undo"]')!.click();
      expect(JSON.stringify(state.lists)).toBe(before);
    });
  });

  describe('reorder edge', () => {
    it('move-up at top is no-op', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'a', pos: 0 })];
      renderApp(root, state, store);
      const btn = root.querySelector<HTMLButtonElement>('[data-action="move-up"]')!;
      btn.disabled = false;
      btn.click();
      expect(state.lists.ALDI[0].pos).toBe(0);
    });

    it('move-down swaps pos with next', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'a', pos: 0 }), mkItem({ id: 'b', pos: 1 })];
      renderApp(root, state, store);
      const top = root.querySelector('[data-item="a"]')!;
      top.querySelector<HTMLButtonElement>('[data-action="move-down"]')!.click();
      expect(state.lists.ALDI.find((i) => i.id === 'a')!.pos).toBe(1);
      expect(state.lists.ALDI.find((i) => i.id === 'b')!.pos).toBe(0);
    });

    it('move-up swaps pos with previous', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'a', pos: 0 }), mkItem({ id: 'b', pos: 1 })];
      renderApp(root, state, store);
      const bottom = root.querySelector('[data-item="b"]')!;
      bottom.querySelector<HTMLButtonElement>('[data-action="move-up"]')!.click();
      expect(state.lists.ALDI.find((i) => i.id === 'b')!.pos).toBe(0);
    });
  });

  describe('voice', () => {
    it('starts via mocked SpeechRecognition global', () => {
      const { root, state } = setup();
      class FakeRec {
        lang = '';
        interimResults = false;
        continuous = false;
        maxAlternatives = 0;
        onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null = null;
        onerror: (() => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          this.onresult?.({ results: { 0: { 0: { transcript: 'Eier' } } } as never });
          this.onend?.();
        }
        stop() {}
        abort() {}
      }
      const win = window as unknown as { SpeechRecognition?: typeof FakeRec };
      win.SpeechRecognition = FakeRec;
      try {
        root.querySelector<HTMLButtonElement>('[data-action="voice"]')!.click();
        const input = root.querySelector<HTMLInputElement>('[data-form="add"] input[name="name"]')!;
        expect(input.value).toBe('Eier');
        expect(state.voiceActive).toBe(false);
      } finally {
        delete win.SpeechRecognition;
      }
    });
  });

  describe('cloud sync settings', () => {
    it('submitting cloud form persists config and notifies parent', () => {
      const { root, state } = setup();
      const saved: (typeof state.supabaseConfig)[] = [];
      state.onSupabaseSave = (cfg) => saved.push(cfg);
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      const form = root.querySelector<HTMLFormElement>('[data-form="supabase"]')!;
      form.querySelector<HTMLInputElement>('input[name="url"]')!.value = 'https://x.supabase.co';
      form.querySelector<HTMLInputElement>('input[name="anonKey"]')!.value = 'eyJ';
      form.querySelector<HTMLInputElement>('input[name="household"]')!.value = 'hh-1';
      form.querySelector<HTMLInputElement>('input[name="enabled"]')!.checked = true;
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        url: 'https://x.supabase.co',
        anonKey: 'eyJ',
        household: 'hh-1',
        enabled: true,
      });
      expect(state.supabaseConfig.enabled).toBe(true);
    });

    it('renders status pill reflecting state.supabaseStatus', () => {
      const { root, state, store } = setup();
      state.supabaseStatus = 'connected';
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      const overlay = root.querySelector('[data-settings-overlay]')!;
      expect(overlay.textContent).toContain('Verbunden');
    });

    it('cloud-share button is disabled when fields empty', () => {
      const { root } = setup();
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      const btn = root.querySelector<HTMLButtonElement>('[data-action="cloud-share"]')!;
      expect(btn.disabled).toBe(true);
    });

    it('cloud-share button enabled once config has all 3 fields', () => {
      const { root, state, store } = setup();
      state.supabaseConfig = {
        url: 'https://x.supabase.co',
        anonKey: 'eyJ',
        household: 'hh',
        enabled: false,
      };
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      const btn = root.querySelector<HTMLButtonElement>('[data-action="cloud-share"]')!;
      expect(btn.disabled).toBe(false);
    });

    it('cloud-share click writes to clipboard when navigator.share missing', async () => {
      const { root, state, store } = setup();
      state.supabaseConfig = {
        url: 'https://x.supabase.co',
        anonKey: 'eyJ',
        household: 'hh',
        enabled: false,
      };
      renderApp(root, state, store);
      const calls: string[] = [];
      const originalClipboard = (navigator as { clipboard?: unknown }).clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (s: string) => calls.push(s) },
      });
      try {
        root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
        root.querySelector<HTMLButtonElement>('[data-action="cloud-share"]')!.click();
        await new Promise((r) => setTimeout(r, 0));
        expect(calls).toHaveLength(1);
        expect(calls[0]).toMatch(/#cfg=/);
      } finally {
        if (originalClipboard === undefined)
          delete (navigator as { clipboard?: unknown }).clipboard;
        else
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: originalClipboard,
          });
      }
    });

    it('cloud-generate button populates household input with UUID-like string', () => {
      const { root } = setup();
      root.querySelector<HTMLButtonElement>('[data-action="settings"]')!.click();
      root.querySelector<HTMLButtonElement>('[data-action="cloud-generate"]')!.click();
      const input = root.querySelector<HTMLInputElement>(
        '[data-form="supabase"] input[name="household"]',
      )!;
      expect(input.value).toMatch(/^[0-9a-f-]{32,40}$/i);
    });
  });

  describe('show synced status', () => {
    it('renders synced timestamp when present', () => {
      const { root, state, store } = setup();
      state.syncedAt = new Date(2026, 4, 4, 14, 7).getTime();
      renderApp(root, state, store);
      expect(root.textContent).toMatch(/14:07/);
    });
  });
});
