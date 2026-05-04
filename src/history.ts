import type { Item, Shop, ShopLists } from './types';

export interface Suggestion {
  name: string;
  qty?: string;
  cat?: string;
  count: number;
  lastTs: number;
}

function key(name: string): string {
  return name.trim().toLowerCase();
}

export function buildSuggestions(items: Item[]): Suggestion[] {
  const map = new Map<string, Suggestion>();
  for (const it of items) {
    const k = key(it.name);
    if (!k) continue;
    const existing = map.get(k);
    if (existing) {
      existing.count++;
      if (it.ts > existing.lastTs) {
        existing.lastTs = it.ts;
        existing.qty = it.qty ?? existing.qty;
        existing.cat = it.cat ?? existing.cat;
      }
    } else {
      map.set(k, {
        name: it.name.trim(),
        qty: it.qty,
        cat: it.cat,
        count: 1,
        lastTs: it.ts,
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return b.lastTs - a.lastTs;
  });
}

export function suggestionsForShop(lists: ShopLists, shop: Shop): Suggestion[] {
  return buildSuggestions(lists[shop] ?? []);
}

export function categoriesForShop(lists: ShopLists, shop: Shop): string[] {
  const set = new Set<string>();
  for (const it of lists[shop] ?? []) {
    if (it.cat && !it.tomb) set.add(it.cat);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
