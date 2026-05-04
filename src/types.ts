export const SHOPS = ['V-MARKT', 'ALDI', 'EDEKA', 'REWE'] as const;
export type Shop = (typeof SHOPS)[number];

export interface Item {
  id: string;
  name: string;
  done: boolean;
  qty?: string;
  ts: number;
  lamport: number;
  dev: string;
  tomb: boolean;
}

export type ShopLists = Record<Shop, Item[]>;

export const SHOP_META: Record<Shop, { color: string; ring: string; bg: string; label: string }> = {
  'V-MARKT': {
    label: 'V-Markt',
    color: 'text-white',
    bg: 'bg-[#c8102e]',
    ring: 'ring-[#c8102e]',
  },
  ALDI: {
    label: 'ALDI',
    color: 'text-white',
    bg: 'bg-[#00549f]',
    ring: 'ring-[#00549f]',
  },
  EDEKA: {
    label: 'EDEKA',
    color: 'text-slate-900',
    bg: 'bg-[#fcd116]',
    ring: 'ring-[#fcd116]',
  },
  REWE: {
    label: 'REWE',
    color: 'text-white',
    bg: 'bg-[#cc071e]',
    ring: 'ring-[#cc071e]',
  },
};
