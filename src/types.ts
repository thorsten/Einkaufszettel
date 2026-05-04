export type Shop = string;

export const DEFAULT_SHOPS: Shop[] = ['V-MARKT', 'ALDI', 'EDEKA', 'REWE'];

export interface Item {
  id: string;
  name: string;
  done: boolean;
  qty?: string;
  ts: number;
  lamport: number;
  dev: string;
  tomb: boolean;
  cat?: string;
  pos: number;
}

export type ShopLists = Record<Shop, Item[]>;

export interface ShopMeta {
  label: string;
  color: string;
  bg: string;
  ring: string;
}

export const FALLBACK_PALETTE: ShopMeta[] = [
  { label: '', color: 'text-white', bg: 'bg-emerald-600', ring: 'ring-emerald-600' },
  { label: '', color: 'text-white', bg: 'bg-purple-600', ring: 'ring-purple-600' },
  { label: '', color: 'text-white', bg: 'bg-orange-600', ring: 'ring-orange-600' },
  { label: '', color: 'text-white', bg: 'bg-pink-600', ring: 'ring-pink-600' },
  { label: '', color: 'text-white', bg: 'bg-sky-600', ring: 'ring-sky-600' },
  { label: '', color: 'text-slate-900', bg: 'bg-yellow-400', ring: 'ring-yellow-400' },
];

export const SHOP_META: Record<string, ShopMeta> = {
  'V-MARKT': {
    label: 'V-Markt',
    color: 'text-white',
    bg: 'bg-[#c8102e]',
    ring: 'ring-[#c8102e]',
  },
  ALDI: { label: 'ALDI', color: 'text-white', bg: 'bg-[#00549f]', ring: 'ring-[#00549f]' },
  EDEKA: {
    label: 'EDEKA',
    color: 'text-slate-900',
    bg: 'bg-[#fcd116]',
    ring: 'ring-[#fcd116]',
  },
  REWE: { label: 'REWE', color: 'text-white', bg: 'bg-[#cc071e]', ring: 'ring-[#cc071e]' },
};

export function shopMeta(shop: Shop, customOrder: Shop[] = DEFAULT_SHOPS): ShopMeta {
  if (SHOP_META[shop]) return SHOP_META[shop];
  let h = 0;
  for (let i = 0; i < shop.length; i++) h = (h * 31 + shop.charCodeAt(i)) | 0;
  const palette = FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
  // bias by index when shop appears later in registry to keep defaults stable
  void customOrder;
  return { ...palette, label: shop };
}

// Backward-compat alias for tests still importing SHOPS
export const SHOPS = DEFAULT_SHOPS;
