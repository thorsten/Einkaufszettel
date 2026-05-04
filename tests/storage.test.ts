import { beforeEach, describe, expect, it } from 'vitest';
import { ListStore, STORAGE_KEY, type StorageLike } from '../src/storage';
import { emptyLists } from '../src/markdown';
import type { Item } from '../src/types';

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

describe('ListStore', () => {
  let mem: MemoryStorage;
  let store: ListStore;

  beforeEach(() => {
    mem = new MemoryStorage();
    store = new ListStore(mem);
  });

  it('returns empty lists when storage is empty', () => {
    expect(store.load()).toEqual(emptyLists());
  });

  it('persists and restores lists', () => {
    const lists = emptyLists();
    lists.REWE = [mkItem({ id: '1', name: 'Tomaten', qty: '1 kg', lamport: 4 })];
    store.save(lists);

    const md = mem.getItem(STORAGE_KEY);
    expect(md).toContain('# REWE');
    expect(md).toContain('Tomaten');
    expect(md).toContain('lamport:4');

    const reloaded = store.load();
    expect(reloaded.REWE[0]).toMatchObject({
      id: '1',
      name: 'Tomaten',
      qty: '1 kg',
      lamport: 4,
    });
  });

  it('clear wipes storage', () => {
    store.save(emptyLists());
    store.clear();
    expect(mem.getItem(STORAGE_KEY)).toBeNull();
  });

  it('mergeMarkdown unions local with incoming', () => {
    const local = emptyLists();
    local.ALDI = [mkItem({ id: 'a', name: 'lokal', lamport: 2 })];
    store.save(local);

    const incoming = '# ALDI\n- [ ] remote <!-- id:b ts:1 lamport:1 dev:d2 tomb:0 pos:0 -->\n';
    const merged = store.mergeMarkdown(local, incoming);

    expect(merged.ALDI).toHaveLength(2);
    const names = merged.ALDI.map((x) => x.name).sort();
    expect(names).toEqual(['lokal', 'remote']);
    expect(mem.getItem(STORAGE_KEY)).toContain('remote');
  });

  it('mergeMarkdown lets higher lamport from incoming win', () => {
    const local = emptyLists();
    local.ALDI = [mkItem({ id: 'x', name: 'old', lamport: 1 })];

    const incoming = '# ALDI\n- [ ] new <!-- id:x ts:99 lamport:9 dev:d2 tomb:0 pos:0 -->\n';
    const merged = store.mergeMarkdown(local, incoming);
    expect(merged.ALDI[0].name).toBe('new');
  });

  it('exportMarkdown produces parseable text', () => {
    const lists = emptyLists();
    lists['V-MARKT'] = [mkItem({ id: 'x', name: 'Wein', lamport: 3 })];
    expect(store.exportMarkdown(lists)).toContain('- [ ] Wein');
  });
});
