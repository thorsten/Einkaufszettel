import { beforeEach, describe, expect, it } from 'vitest';
import { ShopRegistry, SHOPS_KEY, loadShops } from '../src/shops';
import type { StorageLike } from '../src/storage';
import { DEFAULT_SHOPS } from '../src/types';

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

describe('loadShops', () => {
  it('returns defaults when nothing persisted', () => {
    expect(loadShops(new MemoryStorage())).toEqual([...DEFAULT_SHOPS]);
  });

  it('falls back to defaults for invalid JSON', () => {
    const s = new MemoryStorage();
    s.setItem(SHOPS_KEY, 'not json');
    expect(loadShops(s)).toEqual([...DEFAULT_SHOPS]);
  });
});

describe('ShopRegistry', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('exposes default shops on first run', () => {
    const r = new ShopRegistry(storage);
    expect(r.shops).toEqual([...DEFAULT_SHOPS]);
  });

  it('add inserts new shop and persists', () => {
    let calls = 0;
    const r = new ShopRegistry(storage, () => calls++);
    expect(r.add('DM')).toBe(true);
    expect(r.shops).toContain('DM');
    expect(calls).toBe(1);
    expect(storage.getItem(SHOPS_KEY)).toContain('DM');
  });

  it('add rejects duplicates (case-insensitive)', () => {
    const r = new ShopRegistry(storage);
    expect(r.add('aldi')).toBe(false);
  });

  it('rename updates and persists', () => {
    const r = new ShopRegistry(storage);
    expect(r.rename('ALDI', 'ALDI Süd')).toBe(true);
    expect(r.shops).toContain('ALDI Süd');
  });

  it('rename rejects collisions', () => {
    const r = new ShopRegistry(storage);
    expect(r.rename('ALDI', 'REWE')).toBe(false);
  });

  it('remove drops shop except last', () => {
    const r = new ShopRegistry(storage);
    expect(r.remove('ALDI')).toBe(true);
    while (r.shops.length > 1) r.remove(r.shops[0]);
    expect(r.remove(r.shops[0])).toBe(false);
  });

  it('move shifts ordering', () => {
    const r = new ShopRegistry(storage);
    const before = r.shops[0];
    expect(r.move(before, 1)).toBe(true);
    expect(r.shops[0]).not.toBe(before);
  });

  it('reset restores defaults', () => {
    const r = new ShopRegistry(storage);
    r.add('DM');
    r.reset();
    expect(r.shops).toEqual([...DEFAULT_SHOPS]);
  });
});
