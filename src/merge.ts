import type { Item, ShopLists } from './types';

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
  const out: ShopLists = {};

  const shops = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  for (const shop of shops) {
    const map = new Map<string, Item>();
    const all = [...(a[shop] ?? []), ...(b[shop] ?? [])];
    for (const it of all) {
      const existing = map.get(it.id);
      if (!existing || compareItem(it, existing) > 0) map.set(it.id, it);
    }
    const kept: Item[] = [];
    for (const it of map.values()) {
      if (it.tomb && it.ts < cutoff) continue;
      kept.push(it);
    }
    out[shop] = kept;
  }
  return out;
}

export function mergeMany(lists: ShopLists[], opts?: MergeOptions): ShopLists {
  return lists.reduce((acc, cur) => mergeShopLists(acc, cur, opts), {} as ShopLists);
}
