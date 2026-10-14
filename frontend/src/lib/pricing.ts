import type { ProdVar } from '@/types/db';
import { toDay } from './dates';

type PriceFields = Pick<ProdVar, 'b_price' | 'pr_price' | 'pr_start' | 'pr_end'>;

export interface EffectivePrice {
  price: number;
  original: number | null; // b_price when the promo is active, else null
  onPromo: boolean;
}

export function getEffectivePrice(variant: PriceFields, day = toDay()): EffectivePrice {
  const { b_price, pr_price, pr_start, pr_end } = variant;
  const onPromo =
    pr_price != null && !!pr_start && !!pr_end && pr_price < b_price && day >= pr_start && day <= pr_end;
  return onPromo ? { price: pr_price!, original: b_price, onPromo } : { price: b_price, original: null, onPromo };
}

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2, minimumFractionDigits: 0 });

export function formatPeso(amount: number) {
  return peso.format(amount);
}
