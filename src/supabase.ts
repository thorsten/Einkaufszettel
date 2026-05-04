import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StorageLike } from './storage';
import type { Item, Shop, ShopLists } from './types';

export const TABLE = 'einkaufszettel_items';
export const SUPABASE_KEY = 'einkaufszettel.supabase';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  household: string;
  enabled: boolean;
}

export type SyncStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface Row {
  household: string;
  id: string;
  shop: string;
  name: string;
  qty: string | null;
  cat: string | null;
  done: boolean;
  tomb: boolean;
  pos: number;
  ts: number;
  lamport: number;
  dev: string;
}

export function toRow(household: string, shop: Shop, it: Item): Row {
  return {
    household,
    id: it.id,
    shop,
    name: it.name,
    qty: it.qty ?? null,
    cat: it.cat ?? null,
    done: it.done,
    tomb: it.tomb,
    pos: it.pos,
    ts: it.ts,
    lamport: it.lamport,
    dev: it.dev,
  };
}

export function fromRow(r: Row): { shop: Shop; item: Item } {
  return {
    shop: r.shop,
    item: {
      id: r.id,
      name: r.name,
      qty: r.qty ?? undefined,
      cat: r.cat ?? undefined,
      done: r.done,
      tomb: r.tomb,
      pos: r.pos,
      ts: r.ts,
      lamport: r.lamport,
      dev: r.dev,
    },
  };
}

export type ClientFactory = (url: string, anonKey: string) => SupabaseClient;

const defaultFactory: ClientFactory = (url, anonKey) =>
  createClient(url, anonKey, {
    realtime: { params: { eventsPerSecond: 5 } },
    auth: { persistSession: false },
  });

export interface SupabaseSyncOptions {
  config: SupabaseConfig;
  onIncoming: (shop: Shop, item: Item) => void;
  onStatus: (status: SyncStatus, error?: string) => void;
  clientFactory?: ClientFactory;
}

export class SupabaseSync {
  private client: SupabaseClient | null = null;
  private channel: ReturnType<SupabaseClient['channel']> | null = null;
  private status: SyncStatus = 'idle';
  private pendingPush: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly opts: SupabaseSyncOptions) {}

  getStatus(): SyncStatus {
    return this.status;
  }

  async connect(): Promise<void> {
    const { url, anonKey, household } = this.opts.config;
    if (!url || !anonKey || !household) {
      this.setStatus('error', 'missing config');
      return;
    }
    this.setStatus('connecting');
    const factory = this.opts.clientFactory ?? defaultFactory;
    this.client = factory(url, anonKey);

    try {
      const { data, error } = await this.client.from(TABLE).select('*').eq('household', household);
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Row[]) {
        const { shop, item } = fromRow(row);
        this.opts.onIncoming(shop, item);
      }
    } catch (e) {
      this.setStatus('error', (e as Error).message);
      return;
    }

    this.channel = this.client
      .channel(`einkaufszettel:${household}`)
      .on(
        // postgres_changes is typed loosely in the client
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: TABLE,
          filter: `household=eq.${household}`,
        },
        (payload: { eventType: string; new?: Row }) => {
          if (payload.eventType === 'DELETE') return;
          if (!payload.new) return;
          const { shop, item } = fromRow(payload.new);
          this.opts.onIncoming(shop, item);
        },
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') this.setStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT')
          this.setStatus('error', status);
      });
  }

  async disconnect(): Promise<void> {
    if (this.pendingPush) clearTimeout(this.pendingPush);
    this.pendingPush = null;
    if (this.channel && this.client) await this.client.removeChannel(this.channel);
    this.channel = null;
    this.client = null;
    this.setStatus('idle');
  }

  push(lists: ShopLists, debounceMs = 800): void {
    if (this.pendingPush) clearTimeout(this.pendingPush);
    this.pendingPush = setTimeout(() => {
      void this.flush(lists);
    }, debounceMs);
  }

  async flush(lists: ShopLists): Promise<void> {
    if (!this.client || this.status !== 'connected') return;
    const { household } = this.opts.config;
    const rows: Row[] = [];
    for (const shop of Object.keys(lists)) {
      for (const it of lists[shop]) {
        rows.push(toRow(household, shop, it));
      }
    }
    if (rows.length === 0) return;
    try {
      const { error } = await this.client.from(TABLE).upsert(rows, { onConflict: 'household,id' });
      if (error) throw new Error(error.message);
    } catch (e) {
      this.setStatus('error', (e as Error).message);
    }
  }

  private setStatus(status: SyncStatus, error?: string): void {
    this.status = status;
    this.opts.onStatus(status, error);
  }
}

export function loadConfig(storage: StorageLike): SupabaseConfig {
  const raw = storage.getItem(SUPABASE_KEY);
  const def: SupabaseConfig = { url: '', anonKey: '', household: '', enabled: false };
  if (!raw) return def;
  try {
    const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
    return {
      url: typeof parsed.url === 'string' ? parsed.url : '',
      anonKey: typeof parsed.anonKey === 'string' ? parsed.anonKey : '',
      household: typeof parsed.household === 'string' ? parsed.household : '',
      enabled: parsed.enabled === true,
    };
  } catch {
    return def;
  }
}

export function saveConfig(storage: StorageLike, config: SupabaseConfig): void {
  storage.setItem(SUPABASE_KEY, JSON.stringify(config));
}
