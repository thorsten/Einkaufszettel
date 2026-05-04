import type { StorageLike } from './storage';
import { newId } from './markdown';

export const DEVICE_KEY = 'einkaufszettel.device';

export function getOrCreateDeviceId(storage: StorageLike): string {
  const existing = storage.getItem(DEVICE_KEY);
  if (existing && existing.length > 0) return existing;
  const id = newId();
  storage.setItem(DEVICE_KEY, id);
  return id;
}
