import { beforeEach, describe, expect, it } from 'vitest';
import { Lamport } from '../src/clock';
import { ListStore, type StorageLike } from '../src/storage';
import { renderApp, type AppState } from '../src/ui';
import { ThemeController, type MediaQueryLike } from '../src/theme';
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
  const state: AppState = {
    active: 'ALDI',
    lists: emptyLists(),
    theme,
    device: 'test-dev',
    clock: new Lamport(0),
  };
  renderApp(root, state, store);
  return { root, state, store };
}

describe('renderApp', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
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

  it('adds an item with metadata via the form', () => {
    const { root, state } = setup();
    const form = root.querySelector<HTMLFormElement>('[data-form="add"]')!;
    form.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'Milch';
    form.querySelector<HTMLInputElement>('input[name="qty"]')!.value = '1 L';
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    expect(state.lists.ALDI).toHaveLength(1);
    expect(state.lists.ALDI[0]).toMatchObject({
      name: 'Milch',
      qty: '1 L',
      done: false,
      tomb: false,
      dev: 'test-dev',
    });
    expect(state.lists.ALDI[0].lamport).toBeGreaterThan(0);
  });

  it('toggles item done and bumps lamport', () => {
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

  it('delete tombstones the item instead of removing', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [mkItem({ id: 'x', name: 'Brot', lamport: 1 })];
    renderApp(root, state, store);
    root.querySelector<HTMLButtonElement>('[data-action="delete"]')!.click();
    expect(state.lists.ALDI).toHaveLength(1);
    expect(state.lists.ALDI[0].tomb).toBe(true);
    expect(state.lists.ALDI[0].lamport).toBeGreaterThan(1);
  });

  it('hides tombstoned items from rendered list', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [
      mkItem({ id: 'a', name: 'live' }),
      mkItem({ id: 'b', name: 'dead', tomb: true }),
    ];
    renderApp(root, state, store);
    const items = root.querySelectorAll('[data-item]');
    expect(items).toHaveLength(1);
    expect(items[0].getAttribute('data-item')).toBe('a');
  });

  it('tab counter excludes tombstoned items', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [
      mkItem({ id: 'a', name: 'live', done: false }),
      mkItem({ id: 'b', name: 'dead', done: false, tomb: true }),
    ];
    renderApp(root, state, store);
    const tab = root.querySelector('[data-shop="ALDI"]')!;
    expect(tab.textContent).toContain('1');
  });

  it('switches active shop on tab click', () => {
    const { root, state } = setup();
    root.querySelector<HTMLButtonElement>('[data-shop="REWE"]')!.click();
    expect(state.active).toBe('REWE');
  });

  it('cycles theme on toggle button click', () => {
    const { root, state } = setup();
    expect(state.theme.theme).toBe('system');
    root.querySelector<HTMLButtonElement>('[data-action="theme"]')!.click();
    expect(state.theme.theme).toBe('light');
    root.querySelector<HTMLButtonElement>('[data-action="theme"]')!.click();
    expect(state.theme.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('escapes HTML in item names', () => {
    const { root, state, store } = setup();
    state.lists.ALDI = [mkItem({ id: 'x', name: '<script>alert(1)</script>' })];
    renderApp(root, state, store);
    expect(root.querySelector('script')).toBeNull();
    const span = root.querySelector('[data-item="x"] span')!;
    expect(span.textContent).toBe('<script>alert(1)</script>');
  });
});
