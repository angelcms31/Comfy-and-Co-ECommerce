import { readJSON, writeJSON } from './storage';
import { getEffectivePrice } from './pricing';
import type { CartLine } from '@/types/models';

// the variants ticked in the cart, read by the checkout page.
// saved by prod_var_id because a guest's cart_item ids change after logging in
const KEY = 'comfyco.checkoutIds';

export const saveCheckoutIds = (ids: number[]) => writeJSON(KEY, ids);
export const readCheckoutIds = () => readJSON<number[] | null>(KEY, null);

export const lineTotal = (l: CartLine) => getEffectivePrice(l.variant).price * l.quantity;
export const linesTotal = (lines: CartLine[]) => lines.reduce((sum, l) => sum + lineTotal(l), 0);
export const itemCount = (lines: CartLine[]) => lines.reduce((sum, l) => sum + l.quantity, 0);
