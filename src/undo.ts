import { parseAllMarkdown, serializeAll } from './markdown';
import type { ShopLists } from './types';

export interface UndoEntry {
  label: string;
  snapshot: string;
  expiresAt: number;
}

export interface UndoOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

const DEFAULT_TTL = 5000;
const DEFAULT_MAX = 5;

export class UndoStack {
  private entries: UndoEntry[] = [];
  private readonly ttl: number;
  private readonly max: number;
  private readonly now: () => number;

  constructor(opts: UndoOptions = {}) {
    this.ttl = opts.ttlMs ?? DEFAULT_TTL;
    this.max = opts.maxEntries ?? DEFAULT_MAX;
    this.now = opts.now ?? (() => Date.now());
  }

  push(label: string, lists: ShopLists): void {
    this.entries.push({
      label,
      snapshot: serializeAll(lists),
      expiresAt: this.now() + this.ttl,
    });
    while (this.entries.length > this.max) {
      this.entries.shift();
    }
  }

  peek(): UndoEntry | null {
    this.gc();
    return this.entries.length ? this.entries[this.entries.length - 1] : null;
  }

  pop(): { label: string; lists: ShopLists } | null {
    this.gc();
    const e = this.entries.pop();
    if (!e) return null;
    return { label: e.label, lists: parseAllMarkdown(e.snapshot) };
  }

  clear(): void {
    this.entries = [];
  }

  size(): number {
    this.gc();
    return this.entries.length;
  }

  private gc(): void {
    const t = this.now();
    this.entries = this.entries.filter((e) => e.expiresAt > t);
  }
}
