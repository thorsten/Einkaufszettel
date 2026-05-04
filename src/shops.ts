import { DEFAULT_SHOPS, type Shop } from './types';
import type { StorageLike } from './storage';

export const SHOPS_KEY = 'einkaufszettel.shops';

export function loadShops(storage: StorageLike): Shop[] {
  const raw = storage.getItem(SHOPS_KEY);
  if (!raw) return [...DEFAULT_SHOPS];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      const trimmed = parsed.map((s) => s.trim()).filter((s) => s.length > 0);
      return trimmed.length > 0 ? trimmed : [...DEFAULT_SHOPS];
    }
  } catch {
    // fall through
  }
  return [...DEFAULT_SHOPS];
}

export function saveShops(storage: StorageLike, shops: Shop[]): void {
  storage.setItem(SHOPS_KEY, JSON.stringify(shops));
}

export class ShopRegistry {
  private shopsList: Shop[];

  constructor(
    private readonly storage: StorageLike,
    private readonly onChange?: () => void,
  ) {
    this.shopsList = loadShops(storage);
  }

  get shops(): Shop[] {
    return [...this.shopsList];
  }

  has(shop: Shop): boolean {
    return this.shopsList.includes(shop);
  }

  private persist(): void {
    saveShops(this.storage, this.shopsList);
    this.onChange?.();
  }

  add(shop: Shop): boolean {
    const trimmed = shop.trim();
    if (!trimmed) return false;
    const upper = trimmed.toUpperCase();
    if (this.shopsList.some((s) => s.toUpperCase() === upper)) return false;
    this.shopsList.push(trimmed);
    this.persist();
    return true;
  }

  remove(shop: Shop): boolean {
    const idx = this.shopsList.indexOf(shop);
    if (idx < 0) return false;
    if (this.shopsList.length === 1) return false;
    this.shopsList.splice(idx, 1);
    this.persist();
    return true;
  }

  rename(from: Shop, to: Shop): boolean {
    const trimmed = to.trim();
    if (!trimmed) return false;
    const idx = this.shopsList.indexOf(from);
    if (idx < 0) return false;
    if (this.shopsList.some((s, i) => i !== idx && s.toUpperCase() === trimmed.toUpperCase())) {
      return false;
    }
    this.shopsList[idx] = trimmed;
    this.persist();
    return true;
  }

  move(shop: Shop, dir: -1 | 1): boolean {
    const idx = this.shopsList.indexOf(shop);
    if (idx < 0) return false;
    const target = idx + dir;
    if (target < 0 || target >= this.shopsList.length) return false;
    [this.shopsList[idx], this.shopsList[target]] = [this.shopsList[target], this.shopsList[idx]];
    this.persist();
    return true;
  }

  reset(): void {
    this.shopsList = [...DEFAULT_SHOPS];
    this.persist();
  }
}
