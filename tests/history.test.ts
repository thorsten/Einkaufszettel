import { describe, expect, it } from 'vitest';
import { buildSuggestions, categoriesForShop, suggestionsForShop } from '../src/history';
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

describe('buildSuggestions', () => {
  it('groups by name (case-insensitive) and counts', () => {
    const items = [
      mkItem({ id: '1', name: 'Milch' }),
      mkItem({ id: '2', name: 'milch' }),
      mkItem({ id: '3', name: 'Brot' }),
    ];
    const s = buildSuggestions(items);
    expect(s).toHaveLength(2);
    expect(s[0].name).toBe('Milch');
    expect(s[0].count).toBe(2);
  });

  it('sorts by count desc then lastTs desc', () => {
    const items = [
      mkItem({ id: '1', name: 'A', ts: 1 }),
      mkItem({ id: '2', name: 'B', ts: 5 }),
      mkItem({ id: '3', name: 'B', ts: 6 }),
    ];
    const s = buildSuggestions(items);
    expect(s[0].name).toBe('B');
    expect(s[1].name).toBe('A');
  });

  it('keeps last seen qty + cat', () => {
    const items = [
      mkItem({ id: '1', name: 'Milch', qty: '1 L', cat: 'Milch', ts: 1 }),
      mkItem({ id: '2', name: 'Milch', qty: '2 L', cat: 'Milchprodukte', ts: 2 }),
    ];
    const [s] = buildSuggestions(items);
    expect(s.qty).toBe('2 L');
    expect(s.cat).toBe('Milchprodukte');
  });
});

describe('suggestionsForShop', () => {
  it('returns suggestions for the right shop', () => {
    const lists = emptyLists();
    lists.ALDI = [mkItem({ id: 'a', name: 'Milch' })];
    lists.REWE = [mkItem({ id: 'b', name: 'Brot' })];
    expect(suggestionsForShop(lists, 'ALDI')[0].name).toBe('Milch');
  });
});

describe('categoriesForShop', () => {
  it('returns unique non-tombstoned categories sorted', () => {
    const lists = emptyLists();
    lists.ALDI = [
      mkItem({ id: '1', name: 'Apfel', cat: 'Obst' }),
      mkItem({ id: '2', name: 'Banane', cat: 'Obst' }),
      mkItem({ id: '3', name: 'Milch', cat: 'Milch' }),
      mkItem({ id: '4', name: 'Tot', cat: 'Verschwunden', tomb: true }),
    ];
    expect(categoriesForShop(lists, 'ALDI')).toEqual(['Milch', 'Obst']);
  });
});
