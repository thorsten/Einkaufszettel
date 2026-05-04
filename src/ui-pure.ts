import type { Item } from './types';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function visibleItems(items: Item[]): Item[] {
  return items.filter((i) => !i.tomb);
}

export function matchesSearch(it: Item, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return it.name.toLowerCase().includes(needle) || (it.cat ?? '').toLowerCase().includes(needle);
}

export interface CategoryGroup {
  cat: string;
  label: string;
  items: Item[];
}

export function groupByCategory(items: Item[], unknownLabel: string): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const it of items) {
    const cat = it.cat ?? '';
    const key = cat || '__none__';
    let g = groups.get(key);
    if (!g) {
      g = { cat: key, label: cat || unknownLabel, items: [] };
      groups.set(key, g);
    }
    g.items.push(it);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.cat === '__none__') return 1;
    if (b.cat === '__none__') return -1;
    return a.label.localeCompare(b.label);
  });
}

export function formatTime(ms: number): string {
  const t = new Date(ms);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

export function sortForRender(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    return a.pos - b.pos;
  });
}
