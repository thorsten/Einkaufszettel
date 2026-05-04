import { describe, expect, it } from 'vitest';
import {
  emptyLists,
  maxLamport,
  newItem,
  parseAllMarkdown,
  parseShopMarkdown,
  serializeAll,
  serializeShop,
} from '../src/markdown';
import { SHOPS, type Item } from '../src/types';

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

describe('emptyLists', () => {
  it('returns empty array for every shop', () => {
    const lists = emptyLists();
    for (const s of SHOPS) expect(lists[s]).toEqual([]);
  });
});

describe('newItem', () => {
  it('creates item with metadata', () => {
    const it = newItem({ name: 'Brot', qty: '1', dev: 'd', lamport: 5 });
    expect(it).toMatchObject({ name: 'Brot', qty: '1', dev: 'd', lamport: 5, tomb: false });
    expect(typeof it.id).toBe('string');
    expect(it.ts).toBeGreaterThan(0);
  });
});

describe('serializeShop', () => {
  it('emits metadata comment per item', () => {
    const md = serializeShop('ALDI', [
      mkItem({ id: 'a', name: 'Milch', qty: '2 L', ts: 100, lamport: 3, dev: 'dx' }),
    ]);
    expect(md).toContain('# ALDI');
    expect(md).toContain('- [ ] Milch (2 L) <!-- id:a ts:100 lamport:3 dev:dx tomb:0 -->');
  });

  it('serializes tombstoned items with tomb:1', () => {
    const md = serializeShop('REWE', [mkItem({ id: 'z', name: 'Brot', tomb: true })]);
    expect(md).toContain('tomb:1');
  });

  it('renders empty placeholder when no items', () => {
    expect(serializeShop('REWE', [])).toContain('_keine Einträge_');
  });
});

describe('parseShopMarkdown', () => {
  it('parses items with metadata', () => {
    const md = '- [x] Banane (3) <!-- id:b ts:42 lamport:7 dev:du tomb:0 -->\n';
    const items = parseShopMarkdown(md);
    expect(items[0]).toMatchObject({
      id: 'b',
      name: 'Banane',
      qty: '3',
      done: true,
      ts: 42,
      lamport: 7,
      dev: 'du',
      tomb: false,
    });
  });

  it('parses tombstone flag', () => {
    const items = parseShopMarkdown('- [ ] Alt <!-- id:x ts:1 lamport:1 dev:d tomb:1 -->\n');
    expect(items[0].tomb).toBe(true);
  });

  it('falls back when metadata missing (legacy)', () => {
    const items = parseShopMarkdown('- [ ] Apfel\n- [x] Banane (3)\n');
    expect(items).toHaveLength(2);
    expect(items[0].dev).toBe('legacy');
    expect(items[0].lamport).toBe(0);
    expect(items[0].id).toBeTruthy();
    expect(items[1]).toMatchObject({ name: 'Banane', qty: '3', done: true });
  });

  it('ignores non-item lines', () => {
    expect(parseShopMarkdown('# Header\n\nrandom text\n')).toHaveLength(0);
  });
});

describe('round-trip serialize/parse', () => {
  it('preserves all metadata', () => {
    const original = emptyLists();
    original['V-MARKT'] = [
      mkItem({ id: 'a', name: 'Käse', qty: '200 g', ts: 99, lamport: 2, dev: 'dh' }),
    ];
    original.EDEKA = [mkItem({ id: 'b', name: 'Eier', done: true, lamport: 4 })];

    const md = serializeAll(original);
    const parsed = parseAllMarkdown(md);

    expect(parsed['V-MARKT'][0]).toMatchObject({
      id: 'a',
      name: 'Käse',
      qty: '200 g',
      ts: 99,
      lamport: 2,
      dev: 'dh',
      tomb: false,
    });
    expect(parsed.EDEKA[0]).toMatchObject({ id: 'b', name: 'Eier', done: true, lamport: 4 });
    expect(parsed.ALDI).toEqual([]);
  });

  it('preserves tombstones across round-trip', () => {
    const original = emptyLists();
    original.ALDI = [mkItem({ id: 't', name: 'Weg', tomb: true, lamport: 9 })];
    const parsed = parseAllMarkdown(serializeAll(original));
    expect(parsed.ALDI[0]).toMatchObject({ id: 't', tomb: true, lamport: 9 });
  });

  it('handles unknown shop blocks by ignoring', () => {
    const md =
      '# UNKNOWN\n- [ ] foo\n# ALDI\n- [ ] Milch <!-- id:1 ts:1 lamport:1 dev:d tomb:0 -->\n';
    const parsed = parseAllMarkdown(md);
    expect(parsed.ALDI[0].name).toBe('Milch');
  });
});

describe('maxLamport', () => {
  it('returns highest lamport across shops', () => {
    const lists = emptyLists();
    lists.ALDI = [mkItem({ lamport: 3 }), mkItem({ id: 'i2', lamport: 7 })];
    lists.REWE = [mkItem({ id: 'i3', lamport: 5 })];
    expect(maxLamport(lists)).toBe(7);
  });

  it('returns 0 when empty', () => {
    expect(maxLamport(emptyLists())).toBe(0);
  });
});
