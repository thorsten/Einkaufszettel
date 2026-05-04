import { beforeEach, describe, expect, it } from 'vitest';
import { I18n, LANG_KEY, detectLang, isLang, nextLang } from '../src/i18n';
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

describe('isLang', () => {
  it('accepts only known values', () => {
    expect(isLang('de')).toBe(true);
    expect(isLang('en')).toBe(true);
    expect(isLang('fr')).toBe(false);
    expect(isLang(null)).toBe(false);
  });
});

describe('detectLang', () => {
  it('detects en for en-* navigators', () => {
    expect(detectLang('en')).toBe('en');
    expect(detectLang('en-US')).toBe('en');
    expect(detectLang('EN-GB')).toBe('en');
  });
  it('falls back to de otherwise', () => {
    expect(detectLang('de-DE')).toBe('de');
    expect(detectLang(null)).toBe('de');
    expect(detectLang(undefined)).toBe('de');
  });
});

describe('nextLang', () => {
  it('toggles de ↔ en', () => {
    expect(nextLang('de')).toBe('en');
    expect(nextLang('en')).toBe('de');
  });
});

describe('I18n', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('uses detect when no persisted value', () => {
    const i = new I18n(storage, () => 'en');
    expect(i.lang).toBe('en');
  });

  it('restores persisted value', () => {
    storage.setItem(LANG_KEY, 'en');
    const i = new I18n(storage, () => 'de');
    expect(i.lang).toBe('en');
  });

  it('cycle persists and notifies', () => {
    let changes = 0;
    const i = new I18n(
      storage,
      () => 'de',
      () => changes++,
    );
    expect(i.cycle()).toBe('en');
    expect(storage.getItem(LANG_KEY)).toBe('en');
    expect(changes).toBe(1);
  });

  it('t looks up keys', () => {
    const i = new I18n(storage, () => 'de');
    expect(i.t('add')).toBe('Hinzufügen');
    i.set('en');
    expect(i.t('add')).toBe('Add');
  });

  it('t falls back to de when key missing in active dict', () => {
    const i = new I18n(storage, () => 'en');
    expect(i.t('does_not_exist')).toBe('does_not_exist');
  });
});
