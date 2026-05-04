import { describe, expect, it } from 'vitest';
import { UndoStack } from '../src/undo';
import { emptyLists } from '../src/markdown';
import type { Item, ShopLists } from '../src/types';

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

function listsWith(items: Item[]): ShopLists {
  const l = emptyLists();
  l.ALDI = items;
  return l;
}

describe('UndoStack', () => {
  it('starts empty', () => {
    const s = new UndoStack();
    expect(s.size()).toBe(0);
    expect(s.peek()).toBeNull();
    expect(s.pop()).toBeNull();
  });

  it('push + peek + pop returns parsed lists', () => {
    const s = new UndoStack();
    s.push('add', listsWith([mkItem({ id: 'a', name: 'Milch' })]));
    expect(s.size()).toBe(1);
    expect(s.peek()?.label).toBe('add');
    const popped = s.pop();
    expect(popped?.label).toBe('add');
    expect(popped?.lists.ALDI[0].name).toBe('Milch');
    expect(s.size()).toBe(0);
  });

  it('caps at maxEntries', () => {
    const s = new UndoStack({ maxEntries: 2 });
    s.push('a', listsWith([mkItem({ id: '1' })]));
    s.push('b', listsWith([mkItem({ id: '2' })]));
    s.push('c', listsWith([mkItem({ id: '3' })]));
    expect(s.size()).toBe(2);
    expect(s.pop()?.label).toBe('c');
    expect(s.pop()?.label).toBe('b');
    expect(s.pop()).toBeNull();
  });

  it('expires entries past ttl', () => {
    let now = 0;
    const s = new UndoStack({ ttlMs: 1000, now: () => now });
    s.push('old', emptyLists());
    now = 2000;
    expect(s.peek()).toBeNull();
    expect(s.pop()).toBeNull();
  });

  it('clear empties stack', () => {
    const s = new UndoStack();
    s.push('a', emptyLists());
    s.push('b', emptyLists());
    s.clear();
    expect(s.size()).toBe(0);
  });
});
