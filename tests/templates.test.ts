import { beforeEach, describe, expect, it } from 'vitest';
import { TemplateStore, TEMPLATES_KEY } from '../src/templates';
import { emptyLists } from '../src/markdown';
import type { Item } from '../src/types';
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

describe('TemplateStore', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('save persists template and list returns it', () => {
    const s = new TemplateStore(storage);
    const lists = emptyLists();
    lists.ALDI = [mkItem({ id: 'a', name: 'Milch' })];
    expect(s.save('Wochen', lists)).toBe(true);
    const all = s.list();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Wochen');
  });

  it('save trims and rejects empty names', () => {
    const s = new TemplateStore(storage);
    expect(s.save('   ', emptyLists())).toBe(false);
  });

  it('save replaces existing by name', () => {
    const s = new TemplateStore(storage);
    s.save('T', emptyLists());
    s.save('T', emptyLists());
    expect(s.list()).toHaveLength(1);
  });

  it('remove deletes by name', () => {
    const s = new TemplateStore(storage);
    s.save('T', emptyLists());
    expect(s.remove('T')).toBe(true);
    expect(s.list()).toHaveLength(0);
  });

  it('apply yields fresh ids and current lamports, drops tombstones', () => {
    const s = new TemplateStore(storage);
    const lists = emptyLists();
    lists.ALDI = [
      mkItem({ id: 'live', name: 'Milch' }),
      mkItem({ id: 'dead', name: 'Brot', tomb: true }),
    ];
    s.save('T', lists);
    let n = 10;
    const applied = s.apply('T', 'devX', () => ++n);
    expect(applied?.ALDI).toHaveLength(1);
    expect(applied?.ALDI[0].name).toBe('Milch');
    expect(applied?.ALDI[0].id).not.toBe('live');
    expect(applied?.ALDI[0].dev).toBe('devX');
    expect(applied?.ALDI[0].lamport).toBeGreaterThan(10);
    expect(applied?.ALDI[0].done).toBe(false);
  });

  it('apply returns null for unknown name', () => {
    const s = new TemplateStore(storage);
    expect(s.apply('missing', 'd', () => 1)).toBeNull();
  });

  it('survives invalid persisted JSON', () => {
    storage.setItem(TEMPLATES_KEY, '{not-json');
    const s = new TemplateStore(storage);
    expect(s.list()).toEqual([]);
  });
});
