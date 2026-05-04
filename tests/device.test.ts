import { describe, expect, it } from 'vitest';
import { DEVICE_KEY, getOrCreateDeviceId } from '../src/device';
import type { StorageLike } from '../src/storage';

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

describe('getOrCreateDeviceId', () => {
  it('mints and persists on first call', () => {
    const s = new MemoryStorage();
    const id = getOrCreateDeviceId(s);
    expect(id).toBeTruthy();
    expect(s.getItem(DEVICE_KEY)).toBe(id);
  });

  it('returns same id on subsequent calls', () => {
    const s = new MemoryStorage();
    const a = getOrCreateDeviceId(s);
    const b = getOrCreateDeviceId(s);
    expect(a).toBe(b);
  });
});
