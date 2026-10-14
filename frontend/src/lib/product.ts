import type { ProdVar } from '@/types/db';
import type { ProductWithVariants } from '@/types/models';
import { LOW_STOCK_LIMIT } from './constants';
import { getEffectivePrice } from './pricing';

export const isBuyable = (v: Pick<ProdVar, 'is_avail' | 'stocks'>) => v.is_avail && v.stocks > 0;

// the variant shown on cards: first one in stock, else the first one
export function displayVariant(p: ProductWithVariants) {
  return p.variants.find(isBuyable) ?? p.variants[0];
}

export function onPromo(p: ProductWithVariants) {
  return p.variants.some((v) => getEffectivePrice(v).onPromo);
}

export function stockLabel(v: Pick<ProdVar, 'is_avail' | 'stocks'>) {
  if (!isBuyable(v)) return { text: 'Out of stock', tone: 'out' as const };
  if (v.stocks <= LOW_STOCK_LIMIT) return { text: `Only ${v.stocks} left`, tone: 'low' as const };
  return { text: 'In stock', tone: 'ok' as const };
}

// card / tile background colors from the design, picked by index
export const TILE_COLORS = ['bg-mint', 'bg-butter', 'bg-coral'];
export const tileColor = (i: number) => TILE_COLORS[i % TILE_COLORS.length];
