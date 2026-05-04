import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  formatTime,
  groupByCategory,
  matchesSearch,
  sortForRender,
  visibleItems,
} from '../src/ui-pure';
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

describe('escapeHtml', () => {
  it('escapes html special chars', () => {
    expect(escapeHtml(`<script>"&'a</script>`)).toBe(
      '&lt;script&gt;&quot;&amp;&#39;a&lt;/script&gt;',
    );
  });
  it('returns empty for empty', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('visibleItems', () => {
  it('filters out tombstoned', () => {
    const items = [mkItem({ id: 'a' }), mkItem({ id: 'b', tomb: true })];
    expect(visibleItems(items).map((i) => i.id)).toEqual(['a']);
  });
});

describe('matchesSearch', () => {
  const it1 = mkItem({ name: 'Milch', cat: 'Milchprodukte' });
  it('empty query matches all', () => {
    expect(matchesSearch(it1, '')).toBe(true);
  });
  it('matches name substring case-insensitive', () => {
    expect(matchesSearch(it1, 'mi')).toBe(true);
    expect(matchesSearch(it1, 'MILCH')).toBe(true);
  });
  it('matches category substring', () => {
    expect(matchesSearch(it1, 'produkte')).toBe(true);
  });
  it('returns false when no match', () => {
    expect(matchesSearch(it1, 'banane')).toBe(false);
  });
  it('handles items without category', () => {
    expect(matchesSearch(mkItem({ name: 'Brot' }), 'br')).toBe(true);
    expect(matchesSearch(mkItem({ name: 'Brot' }), 'banane')).toBe(false);
  });
});

describe('groupByCategory', () => {
  it('groups by cat alphabetically with uncategorized last', () => {
    const groups = groupByCategory(
      [
        mkItem({ id: '1', name: 'Apfel', cat: 'Obst' }),
        mkItem({ id: '2', name: 'Brot', cat: 'Backwaren' }),
        mkItem({ id: '3', name: 'X' }),
      ],
      'Sonstiges',
    );
    expect(groups.map((g) => g.label)).toEqual(['Backwaren', 'Obst', 'Sonstiges']);
  });

  it('returns empty array for empty input', () => {
    expect(groupByCategory([], 'Sonstiges')).toEqual([]);
  });

  it('treats undefined cat as uncategorized fallback label', () => {
    const [g] = groupByCategory([mkItem({ id: '1', cat: undefined })], 'Other');
    expect(g.label).toBe('Other');
    expect(g.cat).toBe('__none__');
  });
});

describe('formatTime', () => {
  it('zero-pads hours and minutes', () => {
    const ms = new Date(2026, 4, 4, 7, 5).getTime();
    expect(formatTime(ms)).toBe('07:05');
  });
  it('formats afternoon time', () => {
    const ms = new Date(2026, 4, 4, 23, 59).getTime();
    expect(formatTime(ms)).toBe('23:59');
  });
});

describe('sortForRender', () => {
  it('not-done before done', () => {
    const items = [
      mkItem({ id: '1', done: true, pos: 0 }),
      mkItem({ id: '2', done: false, pos: 1 }),
    ];
    expect(sortForRender(items).map((i) => i.id)).toEqual(['2', '1']);
  });
  it('within same done group, sort by pos asc', () => {
    const items = [
      mkItem({ id: '1', pos: 5 }),
      mkItem({ id: '2', pos: 2 }),
      mkItem({ id: '3', pos: 9 }),
    ];
    expect(sortForRender(items).map((i) => i.id)).toEqual(['2', '1', '3']);
  });
  it('does not mutate input', () => {
    const items = [mkItem({ id: '1', pos: 5 }), mkItem({ id: '2', pos: 1 })];
    const before = items.map((i) => i.id);
    sortForRender(items);
    expect(items.map((i) => i.id)).toEqual(before);
  });
});
