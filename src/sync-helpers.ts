import { compareItem } from './merge';
import type { Item, Shop, ShopLists } from './types';

export function applyIncoming(lists: ShopLists, shop: Shop, item: Item): boolean {
  if (!lists[shop]) lists[shop] = [];
  const bucket = lists[shop];
  const idx = bucket.findIndex((i) => i.id === item.id);
  if (idx < 0) {
    bucket.push(item);
    return true;
  }
  if (compareItem(item, bucket[idx]) > 0) {
    bucket[idx] = item;
    return true;
  }
  return false;
}

export function generateHouseholdId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const a = Math.random().toString(16).slice(2).padStart(8, '0').slice(0, 8);
  const b = Math.random().toString(16).slice(2).padStart(4, '0').slice(0, 4);
  const c = Math.random().toString(16).slice(2).padStart(4, '0').slice(0, 4);
  const d = Math.random().toString(16).slice(2).padStart(4, '0').slice(0, 4);
  const e = Math.random().toString(16).slice(2).padStart(12, '0').slice(0, 12);
  return `${a}-${b}-4${c.slice(1)}-${d}-${e}`;
}
