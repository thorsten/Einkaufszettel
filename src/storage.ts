import { emptyLists, parseAllMarkdown, serializeAll } from './markdown';
import { mergeShopLists } from './merge';
import type { Shop, ShopLists } from './types';

export const STORAGE_KEY = 'einkaufszettel.v1.md';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveListener = (lists: ShopLists) => void;

export class ListStore {
  private listeners: Set<SaveListener> = new Set();

  constructor(private readonly storage: StorageLike) {}

  onSave(listener: SaveListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  load(): ShopLists {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return emptyLists();
    try {
      return parseAllMarkdown(raw);
    } catch {
      return emptyLists();
    }
  }

  save(lists: ShopLists, order?: Shop[]): void {
    this.storage.setItem(STORAGE_KEY, serializeAll(lists, order));
    for (const l of this.listeners) l(lists);
  }

  saveQuiet(lists: ShopLists, order?: Shop[]): void {
    this.storage.setItem(STORAGE_KEY, serializeAll(lists, order));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }

  exportMarkdown(lists: ShopLists, order?: Shop[]): string {
    return serializeAll(lists, order);
  }

  mergeMarkdown(localLists: ShopLists, incomingMd: string): ShopLists {
    const incoming = parseAllMarkdown(incomingMd);
    const merged = mergeShopLists(localLists, incoming);
    this.save(merged);
    return merged;
  }
}
