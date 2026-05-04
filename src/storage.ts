import { emptyLists, parseAllMarkdown, serializeAll } from './markdown';
import { mergeShopLists } from './merge';
import type { ShopLists } from './types';

export const STORAGE_KEY = 'einkaufszettel.v1.md';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class ListStore {
  constructor(private readonly storage: StorageLike) {}

  load(): ShopLists {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return emptyLists();
    try {
      return parseAllMarkdown(raw);
    } catch {
      return emptyLists();
    }
  }

  save(lists: ShopLists): void {
    this.storage.setItem(STORAGE_KEY, serializeAll(lists));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }

  exportMarkdown(lists: ShopLists): string {
    return serializeAll(lists);
  }

  mergeMarkdown(localLists: ShopLists, incomingMd: string): ShopLists {
    const incoming = parseAllMarkdown(incomingMd);
    const merged = mergeShopLists(localLists, incoming);
    this.save(merged);
    return merged;
  }
}
