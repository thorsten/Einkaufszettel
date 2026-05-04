import { newId, parseAllMarkdown, serializeAll } from './markdown';
import type { ShopLists } from './types';
import type { StorageLike } from './storage';

export const TEMPLATES_KEY = 'einkaufszettel.templates';

export interface Template {
  name: string;
  markdown: string;
  createdAt: number;
}

interface PersistedTemplate {
  name: unknown;
  markdown: unknown;
  createdAt: unknown;
}

export class TemplateStore {
  private templates: Template[];

  constructor(
    private readonly storage: StorageLike,
    private readonly onChange?: () => void,
  ) {
    this.templates = this.read();
  }

  list(): Template[] {
    return [...this.templates].sort((a, b) => a.name.localeCompare(b.name));
  }

  get(name: string): Template | undefined {
    return this.templates.find((t) => t.name === name);
  }

  save(name: string, lists: ShopLists, order?: string[]): boolean {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const md = serializeAll(lists, order);
    const existing = this.templates.findIndex((t) => t.name === trimmed);
    const entry: Template = { name: trimmed, markdown: md, createdAt: Date.now() };
    if (existing >= 0) this.templates[existing] = entry;
    else this.templates.push(entry);
    this.persist();
    return true;
  }

  remove(name: string): boolean {
    const idx = this.templates.findIndex((t) => t.name === name);
    if (idx < 0) return false;
    this.templates.splice(idx, 1);
    this.persist();
    return true;
  }

  apply(name: string, dev: string, lamportSource: () => number): ShopLists | null {
    const tpl = this.get(name);
    if (!tpl) return null;
    const parsed = parseAllMarkdown(tpl.markdown);
    const out: ShopLists = {};
    for (const shop of Object.keys(parsed)) {
      out[shop] = parsed[shop]
        .filter((it) => !it.tomb)
        .map((it) => ({
          ...it,
          id: newId(),
          done: false,
          dev,
          lamport: lamportSource(),
          ts: Date.now(),
          tomb: false,
        }));
    }
    return out;
  }

  private persist(): void {
    this.storage.setItem(TEMPLATES_KEY, JSON.stringify(this.templates));
    this.onChange?.();
  }

  private read(): Template[] {
    const raw = this.storage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const out: Template[] = [];
      for (const entry of parsed as PersistedTemplate[]) {
        if (
          typeof entry?.name === 'string' &&
          typeof entry?.markdown === 'string' &&
          typeof entry?.createdAt === 'number'
        ) {
          out.push({ name: entry.name, markdown: entry.markdown, createdAt: entry.createdAt });
        }
      }
      return out;
    } catch {
      return [];
    }
  }
}
