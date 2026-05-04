import { emptyLists } from './markdown';
import { SHOPS, type Item, type ShopLists } from './types';

export function compareItem(a: Item, b: Item): number {
  if (a.lamport !== b.lamport) return a.lamport - b.lamport;
  if (a.ts !== b.ts) return a.ts - b.ts;
  if (a.dev !== b.dev) return a.dev < b.dev ? -1 : 1;
  return 0;
}

export interface MergeOptions {
  tombstoneRetentionMs?: number;
  now?: number;
}

const DEFAULT_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;

export function mergeShopLists(a: ShopLists, b: ShopLists, opts: MergeOptions = {}): ShopLists {
  const retention = opts.tombstoneRetentionMs ?? DEFAULT_RETENTION_MS;
  const now = opts.now ?? Date.now();
  const cutoff = now - retention;
  const out = emptyLists();

  for (const shop of SHOPS) {
    const map = new Map<string, Item>();
    for (const it of [...a[shop], ...b[shop]]) {
      const existing = map.get(it.id);
      if (!existing || compareItem(it, existing) > 0) {
        map.set(it.id, it);
      }
    }
    for (const it of map.values()) {
      if (it.tomb && it.ts < cutoff) continue;
      out[shop].push(it);
    }
  }
  return out;
}

export function mergeMany(lists: ShopLists[], opts?: MergeOptions): ShopLists {
  return lists.reduce((acc, cur) => mergeShopLists(acc, cur, opts), emptyLists());
}
