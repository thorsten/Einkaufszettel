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
import { DEFAULT_SHOPS, type Item } from '../src/types';

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

describe('emptyLists', () => {
  it('returns empty array for every default shop', () => {
    const lists = emptyLists();
    for (const s of DEFAULT_SHOPS) expect(lists[s]).toEqual([]);
  });
  it('respects custom shop list', () => {
    const lists = emptyLists(['DM', 'Müller']);
    expect(lists['DM']).toEqual([]);
    expect(lists['Müller']).toEqual([]);
  });
});

describe('newItem', () => {
  it('creates item with metadata + pos', () => {
    const it = newItem({ name: 'Brot', qty: '1', dev: 'd', lamport: 5, pos: 7 });
    expect(it).toMatchObject({ name: 'Brot', qty: '1', dev: 'd', lamport: 5, pos: 7, tomb: false });
    expect(typeof it.id).toBe('string');
  });
});

describe('serializeShop', () => {
  it('emits metadata comment with pos', () => {
    const md = serializeShop('ALDI', [
      mkItem({ id: 'a', name: 'Milch', qty: '2 L', ts: 100, lamport: 3, dev: 'dx', pos: 5 }),
    ]);
    expect(md).toContain('- [ ] Milch (2 L) <!-- id:a ts:100 lamport:3 dev:dx tomb:0 pos:5 -->');
  });

  it('serializes category when present', () => {
    const md = serializeShop('ALDI', [mkItem({ id: 'c', name: 'Apfel', cat: 'Obst' })]);
    expect(md).toContain('cat:Obst');
  });

  it('escapes spaces in category', () => {
    const md = serializeShop('ALDI', [mkItem({ id: 'c', name: 'X', cat: 'Frische Ware' })]);
    expect(md).toContain('cat:Frische_Ware');
  });
});

describe('parseShopMarkdown', () => {
  it('parses pos', () => {
    const items = parseShopMarkdown('- [ ] X <!-- id:a ts:1 lamport:1 dev:d tomb:0 pos:42 -->\n');
    expect(items[0].pos).toBe(42);
  });

  it('parses category and unescapes underscores', () => {
    const items = parseShopMarkdown(
      '- [ ] X <!-- id:a ts:1 lamport:1 dev:d tomb:0 pos:1 cat:Frische_Ware -->\n',
    );
    expect(items[0].cat).toBe('Frische Ware');
  });

  it('legacy without metadata gets sequential pos', () => {
    const items = parseShopMarkdown('- [ ] A\n- [ ] B\n');
    expect(items[0].pos).toBe(0);
    expect(items[1].pos).toBe(1);
  });
});

describe('round-trip serialize/parse', () => {
  it('preserves all metadata including cat + pos', () => {
    const original = emptyLists();
    original['ALDI'] = [
      mkItem({ id: 'a', name: 'Käse', qty: '200 g', cat: 'Milch', pos: 3, lamport: 2 }),
    ];
    const parsed = parseAllMarkdown(serializeAll(original, ['ALDI']));
    expect(parsed.ALDI[0]).toMatchObject({
      id: 'a',
      name: 'Käse',
      qty: '200 g',
      cat: 'Milch',
      pos: 3,
      lamport: 2,
    });
  });

  it('serializeAll respects shop order', () => {
    const lists = emptyLists();
    lists['REWE'] = [mkItem({ id: 'r' })];
    lists['ALDI'] = [mkItem({ id: 'a' })];
    const md = serializeAll(lists, ['REWE', 'ALDI']);
    const reweAt = md.indexOf('# REWE');
    const aldiAt = md.indexOf('# ALDI');
    expect(reweAt).toBeLessThan(aldiAt);
  });

  it('parses unknown shop name as custom shop key', () => {
    const md = '# DM\n- [ ] Zahnpasta <!-- id:z ts:1 lamport:1 dev:d tomb:0 pos:0 -->\n';
    const parsed = parseAllMarkdown(md);
    expect(parsed['DM']?.[0]?.name).toBe('Zahnpasta');
  });
});

describe('maxLamport', () => {
  it('returns highest lamport across shops', () => {
    const lists = emptyLists();
    lists.ALDI = [mkItem({ lamport: 3 }), mkItem({ id: 'i2', lamport: 7 })];
    lists.REWE = [mkItem({ id: 'i3', lamport: 5 })];
    expect(maxLamport(lists)).toBe(7);
  });
});
