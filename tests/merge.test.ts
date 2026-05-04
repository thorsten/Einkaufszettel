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
    pos: 0,
    ...over,
  };
}

describe('compareItem', () => {
  it('lamport dominates ts', () => {
    expect(
      compareItem(mkItem({ lamport: 1, ts: 9999 }), mkItem({ lamport: 2, ts: 1 })),
    ).toBeLessThan(0);
  });
  it('dev breaks tie', () => {
    expect(compareItem(mkItem({ dev: 'aaa' }), mkItem({ dev: 'zzz' }))).toBeLessThan(0);
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
  });

  it('higher lamport wins', () => {
    const a = emptyLists();
    const b = emptyLists();
    a.REWE = [mkItem({ id: 'x', name: 'old', lamport: 1 })];
    b.REWE = [mkItem({ id: 'x', name: 'new', lamport: 5 })];
    const m = mergeShopLists(a, b);
    expect(m.REWE[0].name).toBe('new');
  });

  it('drops tombstones older than retention', () => {
    const a = emptyLists();
    a.ALDI = [mkItem({ id: 'old', tomb: true, ts: 0, lamport: 1 })];
    const m = mergeShopLists(a, emptyLists(), { tombstoneRetentionMs: 1000, now: 10_000 });
    expect(m.ALDI).toHaveLength(0);
  });

  it('merges shops added by either side (custom shops)', () => {
    const a: Record<string, Item[]> = {};
    const b: Record<string, Item[]> = {};
    a['DM'] = [mkItem({ id: 'd', name: 'Zahnpasta' })];
    b['MÜLLER'] = [mkItem({ id: 'm', name: 'Tee' })];
    const m = mergeShopLists(a, b);
    expect(m['DM']).toHaveLength(1);
    expect(m['MÜLLER']).toHaveLength(1);
  });
});

describe('mergeMany', () => {
  it('merges N device files', () => {
    const a = emptyLists();
    const b = emptyLists();
    const c = emptyLists();
    a.ALDI = [mkItem({ id: '1', name: 'a-only', lamport: 1 })];
    b.ALDI = [mkItem({ id: '2', name: 'b-only', lamport: 1 })];
    c.ALDI = [mkItem({ id: '1', name: 'c-wins', lamport: 9 })];
    const m = mergeMany([a, b, c]);
    expect(m.ALDI).toHaveLength(2);
    expect(m.ALDI.map((x) => x.name).sort()).toEqual(['b-only', 'c-wins']);
  });
});
