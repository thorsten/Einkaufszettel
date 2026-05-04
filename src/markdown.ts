import { DEFAULT_SHOPS, type Item, type Shop, type ShopLists } from './types';

const ITEM_RE = /^-\s+\[( |x|X)\]\s+(.*)$/;
const COMMENT_RE = /\s*<!--\s*(.*?)\s*-->\s*$/;
const QTY_RE = /\s+\(([^)]+)\)\s*$/;

export function emptyLists(shops: Shop[] = [...DEFAULT_SHOPS]): ShopLists {
  const out: ShopLists = {};
  for (const s of shops) out[s] = [];
  return out;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface NewItemInput {
  name: string;
  qty?: string;
  cat?: string;
  dev: string;
  lamport: number;
  pos: number;
  ts?: number;
}

export function newItem(input: NewItemInput): Item {
  return {
    id: newId(),
    name: input.name,
    qty: input.qty,
    cat: input.cat,
    done: false,
    tomb: false,
    dev: input.dev,
    lamport: input.lamport,
    ts: input.ts ?? Date.now(),
    pos: input.pos,
  };
}

function escapeMeta(value: string): string {
  return value.replace(/[\s|]/g, '_');
}

function serializeMeta(it: Item): string {
  const parts = [
    `id:${it.id}`,
    `ts:${it.ts}`,
    `lamport:${it.lamport}`,
    `dev:${it.dev}`,
    `tomb:${it.tomb ? 1 : 0}`,
    `pos:${it.pos}`,
  ];
  if (it.cat) parts.push(`cat:${escapeMeta(it.cat)}`);
  return `<!-- ${parts.join(' ')} -->`;
}

interface ParsedMeta {
  id?: string;
  ts?: number;
  lamport?: number;
  dev?: string;
  tomb?: boolean;
  cat?: string;
  pos?: number;
}

function parseMeta(text: string): ParsedMeta {
  const out: Record<string, string> = {};
  for (const tok of text.split(/\s+/)) {
    const i = tok.indexOf(':');
    if (i > 0) out[tok.slice(0, i)] = tok.slice(i + 1);
  }
  return {
    id: out.id,
    ts: out.ts !== undefined ? Number(out.ts) : undefined,
    lamport: out.lamport !== undefined ? Number(out.lamport) : undefined,
    dev: out.dev,
    tomb: out.tomb === '1' ? true : out.tomb === '0' ? false : undefined,
    cat: out.cat ? out.cat.replace(/_/g, ' ') : undefined,
    pos: out.pos !== undefined ? Number(out.pos) : undefined,
  };
}

export function serializeShop(shop: Shop, items: Item[]): string {
  const lines = [`# ${shop}`, ''];
  if (items.length === 0) {
    lines.push('_keine Einträge_', '');
    return lines.join('\n');
  }
  for (const it of items) {
    const box = it.done ? '[x]' : '[ ]';
    const qty = it.qty ? ` (${it.qty})` : '';
    lines.push(`- ${box} ${it.name}${qty} ${serializeMeta(it)}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function serializeAll(lists: ShopLists, order?: Shop[]): string {
  const shops = order && order.length > 0 ? order : Object.keys(lists);
  // include any extras not in `order` so we don't drop data
  const all = [...shops];
  for (const k of Object.keys(lists)) if (!all.includes(k)) all.push(k);
  return all.map((s) => serializeShop(s, lists[s] ?? [])).join('\n');
}

export function parseShopMarkdown(md: string): Item[] {
  const items: Item[] = [];
  let fallbackPos = 0;
  for (const raw of md.split(/\r?\n/)) {
    const m = raw.match(ITEM_RE);
    if (!m) continue;
    const done = m[1].toLowerCase() === 'x';
    let body = m[2].trim();

    let meta: ParsedMeta = {};
    const cm = body.match(COMMENT_RE);
    if (cm) {
      meta = parseMeta(cm[1]);
      body = body.replace(COMMENT_RE, '').trim();
    }

    let qty: string | undefined;
    const qm = body.match(QTY_RE);
    if (qm) {
      qty = qm[1].trim();
      body = body.replace(QTY_RE, '').trim();
    }
    if (!body) continue;

    items.push({
      id: meta.id ?? newId(),
      name: body,
      done,
      qty,
      cat: meta.cat,
      ts: meta.ts ?? 0,
      lamport: meta.lamport ?? 0,
      dev: meta.dev ?? 'legacy',
      tomb: meta.tomb ?? false,
      pos: meta.pos ?? fallbackPos++,
    });
  }
  return items;
}

export function parseAllMarkdown(md: string): ShopLists {
  const lists: ShopLists = emptyLists();
  const blocks = md.split(/^# /m);
  for (const block of blocks) {
    if (!block.trim()) continue;
    const nl = block.indexOf('\n');
    const header = (nl === -1 ? block : block.slice(0, nl)).trim().toUpperCase();
    if (!header) continue;
    const body = nl === -1 ? '' : block.slice(nl + 1);
    lists[header] = parseShopMarkdown(body);
  }
  return lists;
}

export function maxLamport(lists: ShopLists): number {
  let max = 0;
  for (const items of Object.values(lists)) {
    for (const it of items) if (it.lamport > max) max = it.lamport;
  }
  return max;
}

export function minPos(items: Item[]): number {
  if (items.length === 0) return 0;
  let m = items[0].pos;
  for (const it of items) if (it.pos < m) m = it.pos;
  return m;
}

export function maxPos(items: Item[]): number {
  if (items.length === 0) return 0;
  let m = items[0].pos;
  for (const it of items) if (it.pos > m) m = it.pos;
  return m;
}
