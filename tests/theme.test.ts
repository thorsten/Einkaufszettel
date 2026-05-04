import { beforeEach, describe, expect, it } from 'vitest';
import {
  ThemeController,
  THEME_KEY,
  isTheme,
  nextTheme,
  resolveTheme,
  type MediaQueryLike,
} from '../src/theme';
import type { StorageLike } from '../src/storage';

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
  matches: boolean;
  private listeners = new Set<() => void>();
  constructor(matches = false) {
    this.matches = matches;
  }
  addEventListener(_type: 'change', listener: () => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'change', listener: () => void) {
    this.listeners.delete(listener);
  }
  trigger(matches: boolean) {
    this.matches = matches;
    for (const l of this.listeners) l();
  }
}

describe('isTheme', () => {
  it('accepts only known values', () => {
    expect(isTheme('system')).toBe(true);
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('blue')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});

describe('nextTheme', () => {
  it('cycles system → light → dark → system', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('passes through explicit themes', () => {
    expect(resolveTheme('light', { matches: true })).toBe('light');
    expect(resolveTheme('dark', { matches: false })).toBe('dark');
  });
  it('uses media query when system', () => {
    expect(resolveTheme('system', { matches: true })).toBe('dark');
    expect(resolveTheme('system', { matches: false })).toBe('light');
  });
});

describe('ThemeController', () => {
  let storage: MemoryStorage;
  let mq: FakeMediaQuery;
  let root: HTMLElement;

  beforeEach(() => {
    storage = new MemoryStorage();
    mq = new FakeMediaQuery(false);
    root = document.createElement('html');
  });

  it('defaults to system on first run', () => {
    const t = new ThemeController(storage, mq, root);
    expect(t.theme).toBe('system');
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('restores persisted theme', () => {
    storage.setItem(THEME_KEY, 'dark');
    const t = new ThemeController(storage, mq, root);
    expect(t.theme).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('cycle persists and applies', () => {
    const t = new ThemeController(storage, mq, root);
    expect(t.cycle()).toBe('light');
    expect(storage.getItem(THEME_KEY)).toBe('light');
    expect(root.classList.contains('dark')).toBe(false);
    t.cycle();
    expect(t.theme).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('reacts to system change only when in system mode', () => {
    let calls = 0;
    const t = new ThemeController(storage, mq, root, () => calls++);
    mq.trigger(true);
    expect(root.classList.contains('dark')).toBe(true);
    expect(calls).toBe(1);

    t.set('light');
    calls = 0;
    mq.trigger(false);
    expect(root.classList.contains('dark')).toBe(false);
    expect(calls).toBe(0);
  });

  it('resolved respects current theme', () => {
    const t = new ThemeController(storage, mq, root);
    expect(t.resolved).toBe('light');
    mq.matches = true;
    expect(t.resolved).toBe('dark');
    t.set('light');
    expect(t.resolved).toBe('light');
  });
});
