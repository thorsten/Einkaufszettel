import { describe, expect, it } from 'vitest';
import { applyIncoming, generateHouseholdId } from '../src/sync-helpers';
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

describe('applyIncoming', () => {
  it('inserts new id', () => {
    const lists: ShopLists = {};
    const ok = applyIncoming(lists, 'ALDI', mkItem({ id: 'a' }));
    expect(ok).toBe(true);
    expect(lists.ALDI).toHaveLength(1);
  });

  it('replaces older lamport with newer', () => {
    const lists: ShopLists = { ALDI: [mkItem({ id: 'a', name: 'old', lamport: 1 })] };
    const ok = applyIncoming(lists, 'ALDI', mkItem({ id: 'a', name: 'new', lamport: 5 }));
    expect(ok).toBe(true);
    expect(lists.ALDI[0].name).toBe('new');
  });

  it('keeps existing when incoming lamport is older', () => {
    const lists: ShopLists = { ALDI: [mkItem({ id: 'a', name: 'keep', lamport: 5 })] };
    const ok = applyIncoming(lists, 'ALDI', mkItem({ id: 'a', name: 'older', lamport: 1 }));
    expect(ok).toBe(false);
    expect(lists.ALDI[0].name).toBe('keep');
  });

  it('creates shop bucket if missing', () => {
    const lists: ShopLists = {};
    applyIncoming(lists, 'NEW', mkItem({ id: 'x' }));
    expect(lists.NEW).toHaveLength(1);
  });
});

describe('generateHouseholdId', () => {
  it('produces 36-char UUID-like string', () => {
    const id = generateHouseholdId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });
  it('returns distinct ids', () => {
    expect(generateHouseholdId()).not.toBe(generateHouseholdId());
  });
});
