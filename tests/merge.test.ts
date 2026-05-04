import { describe, expect, it } from 'vitest';
import { compareItem, mergeMany, mergeShopLists } from '../src/merge';
import { emptyLists } from '../src/markdown';
import type { Item } from '../src/types';

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

describe('compareItem', () => {
  it('lamport dominates ts', () => {
    const a = mkItem({ lamport: 1, ts: 9999 });
    const b = mkItem({ lamport: 2, ts: 1 });
    expect(compareItem(a, b)).toBeLessThan(0);
  });

  it('ts breaks tie when lamport equal', () => {
    const a = mkItem({ lamport: 5, ts: 100 });
    const b = mkItem({ lamport: 5, ts: 200 });
    expect(compareItem(a, b)).toBeLessThan(0);
  });

  it('dev breaks tie when both equal', () => {
    const a = mkItem({ dev: 'aaa' });
    const b = mkItem({ dev: 'zzz' });
    expect(compareItem(a, b)).toBeLessThan(0);
  });
});

describe('mergeShopLists', () => {
  it('union when ids differ', () => {
    const a = emptyLists();
    const b = emptyLists();
    a.ALDI = [mkItem({ id: 'a', name: 'Milch' })];
    b.ALDI = [mkItem({ id: 'b', name: 'Brot' })];
    const m = mergeShopLists(a, b);
    expect(m.ALDI).toHaveLength(2);
    expect(m.ALDI.map((x) => x.name).sort()).toEqual(['Brot', 'Milch']);
  });

  it('higher lamport wins for same id', () => {
    const a = emptyLists();
    const b = emptyLists();
    a.REWE = [mkItem({ id: 'x', name: 'old', lamport: 1 })];
    b.REWE = [mkItem({ id: 'x', name: 'new', lamport: 5 })];
    const m = mergeShopLists(a, b);
    expect(m.REWE).toHaveLength(1);
    expect(m.REWE[0].name).toBe('new');
  });

  it('tombstone wins over older edit', () => {
    const a = emptyLists();
    const b = emptyLists();
    const now = Date.now();
    a.EDEKA = [mkItem({ id: 'x', name: 'live', lamport: 2, ts: now, tomb: false })];
    b.EDEKA = [mkItem({ id: 'x', name: 'live', lamport: 9, ts: now, tomb: true })];
    const m = mergeShopLists(a, b, { now });
    expect(m.EDEKA[0].tomb).toBe(true);
  });

  it('newer edit resurrects item over older tombstone', () => {
    const a = emptyLists();
    const b = emptyLists();
    const now = Date.now();
    a['V-MARKT'] = [mkItem({ id: 'x', lamport: 2, ts: now, tomb: true })];
    b['V-MARKT'] = [mkItem({ id: 'x', name: 'back', lamport: 9, ts: now, tomb: false })];
    const m = mergeShopLists(a, b, { now });
    expect(m['V-MARKT'][0].tomb).toBe(false);
    expect(m['V-MARKT'][0].name).toBe('back');
  });

  it('drops tombstone older than retention', () => {
    const a = emptyLists();
    const b = emptyLists();
    a.ALDI = [mkItem({ id: 'old', tomb: true, ts: 0, lamport: 1 })];
    const m = mergeShopLists(a, b, { tombstoneRetentionMs: 1000, now: 10_000 });
    expect(m.ALDI).toHaveLength(0);
  });

  it('keeps recent tombstone within retention', () => {
    const a = emptyLists();
    const b = emptyLists();
    a.ALDI = [mkItem({ id: 'r', tomb: true, ts: 9500, lamport: 1 })];
    const m = mergeShopLists(a, b, { tombstoneRetentionMs: 1000, now: 10_000 });
    expect(m.ALDI).toHaveLength(1);
  });

  it('is idempotent (a ⊕ a = a)', () => {
    const a = emptyLists();
    a.ALDI = [mkItem({ id: '1', lamport: 1 }), mkItem({ id: '2', lamport: 2 })];
    const once = mergeShopLists(a, a);
    const twice = mergeShopLists(once, a);
    expect(twice.ALDI).toHaveLength(2);
    expect(twice.ALDI.map((x) => x.id).sort()).toEqual(['1', '2']);
  });

  it('is commutative (a ⊕ b = b ⊕ a)', () => {
    const a = emptyLists();
    const b = emptyLists();
    a.REWE = [mkItem({ id: 'x', name: 'A', lamport: 5, dev: 'd1' })];
    b.REWE = [mkItem({ id: 'x', name: 'B', lamport: 5, dev: 'd2' })];
    const ab = mergeShopLists(a, b);
    const ba = mergeShopLists(b, a);
    expect(ab.REWE[0].name).toBe(ba.REWE[0].name);
    expect(ab.REWE[0].name).toBe('B');
  });
});

describe('mergeMany', () => {
  it('merges 3 device files', () => {
    const a = emptyLists();
    const b = emptyLists();
    const c = emptyLists();
    a.ALDI = [mkItem({ id: '1', name: 'a-only', lamport: 1 })];
    b.ALDI = [mkItem({ id: '2', name: 'b-only', lamport: 1 })];
    c.ALDI = [mkItem({ id: '1', name: 'c-wins', lamport: 9 })];
    const m = mergeMany([a, b, c]);
    expect(m.ALDI).toHaveLength(2);
    const names = m.ALDI.map((x) => x.name).sort();
    expect(names).toEqual(['b-only', 'c-wins']);
  });
});
