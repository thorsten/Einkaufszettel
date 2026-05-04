import { beforeEach, describe, expect, it } from 'vitest';
import { Lamport } from '../src/clock';
import { I18n } from '../src/i18n';
import { ListStore, type StorageLike } from '../src/storage';
import { ThemeController, type MediaQueryLike } from '../src/theme';
import { renderApp, type AppState } from '../src/ui';
import { UndoStack } from '../src/undo';
import { emptyLists } from '../src/markdown';
import { SHOPS, type Item } from '../src/types';

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
  const state: AppState = {
    active: 'ALDI',
    lists: emptyLists(),
    theme,
    i18n,
    device: 'test-dev',
    clock: new Lamport(0),
    undo: new UndoStack(),
  };
  renderApp(root, state, store);
  return { root, state, store };
}

describe('renderApp', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.classList.remove('dark');
  });

  it('renders 4 shop tabs', () => {
    const { root } = setup();
    expect(root.querySelectorAll('[data-shop]')).toHaveLength(SHOPS.length);
  });

  it('marks active shop tab', () => {
    const { root } = setup();
    expect(root.querySelector('[data-shop="ALDI"]')?.getAttribute('aria-selected')).toBe('true');
  });

  it('shows empty state when no items', () => {
    const { root } = setup();
    expect(root.textContent).toContain('Noch keine Artikel');
  });

  it('adds item via form, snapshots undo, shows toast', () => {
    const { root, state } = setup();
    const form = root.querySelector<HTMLFormElement>('[data-form="add"]')!;
    form.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'Milch';
    form.querySelector<HTMLInputElement>('input[name="qty"]')!.value = '1 L';
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(state.lists.ALDI).toHaveLength(1);
    expect(state.lists.ALDI[0]).toMatchObject({
      name: 'Milch',
      qty: '1 L',
      dev: 'test-dev',
      tomb: false,
    });
    expect(state.undo.size()).toBe(1);
    expect(root.querySelector('[data-toast]')).toBeTruthy();
  });

  it('toggles done and bumps lamport', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [mkItem({ id: 'x', name: 'Brot', lamport: 1 })];
    renderApp(root, state, store);
    const before = state.lists.ALDI[0].lamport;
    root
      .querySelector<HTMLInputElement>('[data-action="toggle"]')!
      .dispatchEvent(new Event('change', { bubbles: true }));
    expect(state.lists.ALDI[0].done).toBe(true);
    expect(state.lists.ALDI[0].lamport).toBeGreaterThan(before);
  });

  it('delete tombstones the item', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [mkItem({ id: 'x', name: 'Brot' })];
    renderApp(root, state, store);
    root.querySelector<HTMLButtonElement>('[data-action="delete"]')!.click();
    expect(state.lists.ALDI).toHaveLength(1);
    expect(state.lists.ALDI[0].tomb).toBe(true);
  });

  it('hides tombstoned items and counts only live in tab', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [
      mkItem({ id: 'a', name: 'live' }),
      mkItem({ id: 'b', name: 'dead', tomb: true }),
    ];
    renderApp(root, state, store);
    expect(root.querySelectorAll('[data-item]')).toHaveLength(1);
    expect(root.querySelector('[data-shop="ALDI"]')!.textContent).toContain('1');
  });

  it('switches active shop on tab click', () => {
    const { root, state } = setup();
    root.querySelector<HTMLButtonElement>('[data-shop="REWE"]')!.click();
    expect(state.active).toBe('REWE');
  });

  it('cycles theme on toggle', () => {
    const { root, state } = setup();
    expect(state.theme.theme).toBe('system');
    root.querySelector<HTMLButtonElement>('[data-action="theme"]')!.click();
    expect(state.theme.theme).toBe('light');
    root.querySelector<HTMLButtonElement>('[data-action="theme"]')!.click();
    expect(state.theme.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('cycles language and re-renders with new strings', () => {
    const { root, state } = setup();
    expect(root.textContent).toContain('Noch keine Artikel');
    root.querySelector<HTMLButtonElement>('[data-action="lang"]')!.click();
    expect(state.i18n.lang).toBe('en');
    expect(root.textContent).toContain('No items yet');
  });

  it('escapes HTML in item names', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [mkItem({ id: 'x', name: '<script>alert(1)</script>' })];
    renderApp(root, state, store);
    expect(root.querySelector('script')).toBeNull();
    const span = root.querySelector('[data-item="x"] span')!;
    expect(span.textContent).toBe('<script>alert(1)</script>');
  });

  describe('edit in place', () => {
    it('shows edit form on edit click', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'x', name: 'Brot' })];
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="edit"]')!.click();
      expect(state.editingId).toBe('x');
      expect(root.querySelector('[data-form="edit"]')).toBeTruthy();
    });

    it('saves edits and bumps lamport', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'x', name: 'Brot', qty: '1', lamport: 1 })];
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="edit"]')!.click();
      const form = root.querySelector<HTMLFormElement>('[data-form="edit"]')!;
      form.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'Vollkornbrot';
      form.querySelector<HTMLInputElement>('input[name="qty"]')!.value = '2';
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      expect(state.lists.ALDI[0].name).toBe('Vollkornbrot');
      expect(state.lists.ALDI[0].qty).toBe('2');
      expect(state.lists.ALDI[0].lamport).toBeGreaterThan(1);
      expect(state.editingId).toBeUndefined();
    });

    it('cancel closes edit without changes', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'x', name: 'Brot' })];
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="edit"]')!.click();
      root.querySelector<HTMLButtonElement>('[data-action="cancel-edit"]')!.click();
      expect(state.editingId).toBeUndefined();
      expect(state.lists.ALDI[0].name).toBe('Brot');
    });
  });

  describe('clear checked', () => {
    it('button absent when no checked items', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'a', done: false })];
      renderApp(root, state, store);
      expect(root.querySelector('[data-action="clear-checked"]')).toBeNull();
    });

    it('button present when at least one checked', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'a', done: true }), mkItem({ id: 'b', done: false })];
      renderApp(root, state, store);
      expect(root.querySelector('[data-action="clear-checked"]')).toBeTruthy();
    });

    it('tombstones all checked items in active shop only', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [
        mkItem({ id: 'a', done: true }),
        mkItem({ id: 'b', done: false }),
        mkItem({ id: 'c', done: true }),
      ];
      state.lists.REWE = [mkItem({ id: 'd', done: true })];
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="clear-checked"]')!.click();
      const aldi = state.lists.ALDI;
      expect(aldi.find((i) => i.id === 'a')?.tomb).toBe(true);
      expect(aldi.find((i) => i.id === 'b')?.tomb).toBe(false);
      expect(aldi.find((i) => i.id === 'c')?.tomb).toBe(true);
      expect(state.lists.REWE[0].tomb).toBe(false);
    });
  });

  describe('undo', () => {
    it('undo restores previous lists after add', () => {
      const { root, state } = setup();
      const form = root.querySelector<HTMLFormElement>('[data-form="add"]')!;
      form.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'Milch';
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      expect(state.lists.ALDI).toHaveLength(1);
      root.querySelector<HTMLButtonElement>('[data-action="undo"]')!.click();
      expect(state.lists.ALDI).toHaveLength(0);
    });

    it('undo restores tombstone after delete', () => {
      const { root, state, store } = setup();
      state.lists.ALDI = [mkItem({ id: 'x', name: 'Brot' })];
      renderApp(root, state, store);
      root.querySelector<HTMLButtonElement>('[data-action="delete"]')!.click();
      expect(state.lists.ALDI[0].tomb).toBe(true);
      root.querySelector<HTMLButtonElement>('[data-action="undo"]')!.click();
      expect(state.lists.ALDI[0].tomb).toBe(false);
    });

    it('undo button hidden when no toast active', () => {
      const { root } = setup();
      expect(root.querySelector('[data-action="undo"]')).toBeNull();
    });
  });
});
