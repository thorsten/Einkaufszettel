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
  });
});
