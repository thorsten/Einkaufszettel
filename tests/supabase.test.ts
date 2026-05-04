import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fromRow,
  loadConfig,
  saveConfig,
  SUPABASE_KEY,
  SupabaseSync,
  toRow,
  type ClientFactory,
  type Row,
  type SupabaseConfig,
} from '../src/supabase';
import type { StorageLike } from '../src/storage';
import type { Item, Shop } from '../src/types';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

function mkItem(over: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    name: 'X',
    done: false,
    qty: undefined,
    ts: 1000,
    lamport: 1,
    dev: 'd1',
    tomb: false,
    pos: 0,
    ...over,
  };
}

describe('toRow / fromRow', () => {
  it('round-trips an item', () => {
    const it = mkItem({ id: 'a', name: 'Milch', qty: '1L', cat: 'Milchprodukte', pos: 7 });
    const row = toRow('hh', 'ALDI', it);
    expect(row.household).toBe('hh');
    expect(row.shop).toBe('ALDI');
    const back = fromRow(row);
    expect(back.shop).toBe('ALDI');
    expect(back.item).toMatchObject({ id: 'a', name: 'Milch', qty: '1L', cat: 'Milchprodukte' });
  });

  it('null fields become undefined on parse', () => {
    const r: Row = {
      household: 'h',
      id: 'a',
      shop: 'X',
      name: 'n',
      qty: null,
      cat: null,
      done: false,
      tomb: false,
      pos: 0,
      ts: 1,
      lamport: 1,
      dev: 'd',
    };
    const { item } = fromRow(r);
    expect(item.qty).toBeUndefined();
    expect(item.cat).toBeUndefined();
  });
});

describe('loadConfig / saveConfig', () => {
  it('returns defaults when nothing persisted', () => {
    const cfg = loadConfig(new MemoryStorage());
    expect(cfg).toEqual({ url: '', anonKey: '', household: '', enabled: false });
  });

  it('round-trips through storage', () => {
    const s = new MemoryStorage();
    const cfg: SupabaseConfig = {
      url: 'https://x.supabase.co',
      anonKey: 'eyJ...',
      household: 'abc',
      enabled: true,
    };
    saveConfig(s, cfg);
    expect(loadConfig(s)).toEqual(cfg);
  });

  it('falls back when JSON is malformed', () => {
    const s = new MemoryStorage();
    s.setItem(SUPABASE_KEY, 'not-json');
    expect(loadConfig(s).enabled).toBe(false);
  });
});

interface FakeChannel {
  handlers: Array<(payload: { eventType: string; new?: Row }) => void>;
  on(
    this: FakeChannel,
    _event: string,
    _filter: unknown,
    fn: FakeChannel['handlers'][number],
  ): FakeChannel;
  subscribe(this: FakeChannel, cb: (status: string) => void): FakeChannel;
  trigger(this: FakeChannel, payload: { eventType: string; new?: Row }): void;
}

function makeFakeClient(initialRows: Row[] = []): {
  factory: ClientFactory;
  channel: FakeChannel;
  upserts: Row[][];
} {
  const upserts: Row[][] = [];
  let subscribeCb: ((status: string) => void) | null = null;
  const channel: FakeChannel = {
    handlers: [],
    on(this: FakeChannel, _event, _filter, fn) {
      this.handlers.push(fn);
      return this;
    },
    subscribe(this: FakeChannel, cb) {
      subscribeCb = cb;
      queueMicrotask(() => cb('SUBSCRIBED'));
      return this;
    },
    trigger(this: FakeChannel, payload) {
      for (const h of this.handlers) h(payload);
    },
  };
  const fakeClient = {
    from() {
      return {
        select() {
          return {
            eq: async () => ({ data: initialRows, error: null }),
          };
        },
        upsert: async (rows: Row[]) => {
          upserts.push(rows);
          return { error: null };
        },
      };
    },
    channel() {
      return channel;
    },
    removeChannel: async () => {
      subscribeCb = null;
    },
  } as unknown as Parameters<ClientFactory>[0] extends string ? never : never;
  void subscribeCb;
  const factory: ClientFactory = () => fakeClient as never;
  return { factory, channel, upserts };
}

describe('SupabaseSync', () => {
  const cfg: SupabaseConfig = {
    url: 'https://x.supabase.co',
    anonKey: 'eyJ',
    household: 'hh',
    enabled: true,
  };

  beforeEach(() => {
    vi.useRealTimers();
  });

  it('errors when config is missing fields', async () => {
    const status = vi.fn();
    const sync = new SupabaseSync({
      config: { url: '', anonKey: '', household: '', enabled: true },
      onIncoming: vi.fn(),
      onStatus: status,
      clientFactory: () => ({}) as never,
    });
    await sync.connect();
    expect(status).toHaveBeenCalledWith('error', 'missing config');
  });

  it('emits initial rows on connect and reaches connected', async () => {
    const onIncoming = vi.fn();
    const onStatus = vi.fn();
    const initial: Row[] = [
      {
        household: 'hh',
        id: 'a',
        shop: 'ALDI',
        name: 'Milch',
        qty: null,
        cat: null,
        done: false,
        tomb: false,
        pos: 0,
        ts: 1,
        lamport: 1,
        dev: 'd2',
      },
    ];
    const { factory } = makeFakeClient(initial);
    const sync = new SupabaseSync({ config: cfg, onIncoming, onStatus, clientFactory: factory });
    await sync.connect();
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(onIncoming).toHaveBeenCalledWith('ALDI', expect.objectContaining({ id: 'a' }));
    const statuses = onStatus.mock.calls.map((c) => c[0]);
    expect(statuses).toContain('connecting');
    expect(statuses).toContain('connected');
  });

  it('forwards realtime payloads and ignores DELETE', async () => {
    const onIncoming = vi.fn();
    const { factory, channel } = makeFakeClient();
    const sync = new SupabaseSync({
      config: cfg,
      onIncoming,
      onStatus: vi.fn(),
      clientFactory: factory,
    });
    await sync.connect();
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    channel.trigger({
      eventType: 'INSERT',
      new: {
        household: 'hh',
        id: 'b',
        shop: 'REWE',
        name: 'Brot',
        qty: null,
        cat: null,
        done: false,
        tomb: false,
        pos: 0,
        ts: 1,
        lamport: 1,
        dev: 'd2',
      },
    });
    expect(onIncoming).toHaveBeenCalledWith('REWE', expect.objectContaining({ id: 'b' }));
    onIncoming.mockReset();
    channel.trigger({ eventType: 'DELETE' });
    expect(onIncoming).not.toHaveBeenCalled();
  });

  it('debounced push collapses rapid mutations into a single upsert', async () => {
    vi.useFakeTimers();
    const { factory, upserts } = makeFakeClient();
    const sync = new SupabaseSync({
      config: cfg,
      onIncoming: vi.fn(),
      onStatus: vi.fn(),
      clientFactory: factory,
    });
    await sync.connect();
    // let microtasks resolve so subscribe → 'connected' fires
    await vi.advanceTimersByTimeAsync(0);
    sync.push({ ALDI: [mkItem({ id: 'a' })] }, 100);
    sync.push({ ALDI: [mkItem({ id: 'a' }), mkItem({ id: 'b' })] }, 100);
    await vi.advanceTimersByTimeAsync(150);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toHaveLength(2);
  });

  it('flush is a no-op before connect', async () => {
    const sync = new SupabaseSync({
      config: cfg,
      onIncoming: vi.fn(),
      onStatus: vi.fn(),
      clientFactory: () => ({}) as never,
    });
    await sync.flush({ ALDI: [mkItem({ id: 'a' })] });
    expect(sync.getStatus()).toBe('idle');
  });

  it('errors when initial select returns error', async () => {
    const onStatus = vi.fn();
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: null, error: { message: 'boom' } }),
        }),
      }),
    } as never;
    const sync = new SupabaseSync({
      config: cfg,
      onIncoming: vi.fn(),
      onStatus,
      clientFactory: () => fakeClient,
    });
    await sync.connect();
    expect(onStatus).toHaveBeenCalledWith('error', 'boom');
  });

  it('disconnect tears down channel and resets status', async () => {
    const onStatus = vi.fn();
    const { factory } = makeFakeClient();
    const sync = new SupabaseSync({
      config: cfg,
      onIncoming: vi.fn(),
      onStatus,
      clientFactory: factory,
    });
    await sync.connect();
    await sync.disconnect();
    expect(sync.getStatus()).toBe('idle');
    expect(onStatus).toHaveBeenLastCalledWith('idle', undefined);
  });
});

describe('SupabaseSync — receive shop: Shop is plain string', () => {
  it('accepts arbitrary custom shop names from server', () => {
    const r: Row = {
      household: 'h',
      id: 'a',
      shop: 'DM' as Shop,
      name: 'Zahnpasta',
      qty: null,
      cat: null,
      done: false,
      tomb: false,
      pos: 0,
      ts: 1,
      lamport: 1,
      dev: 'd',
    };
    const { shop } = fromRow(r);
    expect(shop).toBe('DM');
  });
});
