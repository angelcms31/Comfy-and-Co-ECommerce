import { http } from '@/lib/http';
import { readJSON, removeKey, writeJSON } from '@/lib/storage';
import type { CartLine } from '@/types/models';
import { productService } from './productService';

// Logged in: cart is saved in the cart / cart_item tables through the API.
// Guest: cart is kept in localStorage and merged into the saved cart after login.

const GUEST_KEY = 'comfyco.guestCart';
type GuestItem = { prod_var_id: number; quantity: number };

const readGuest = () => readJSON<GuestItem[]>(GUEST_KEY, []);
const writeGuest = (items: GuestItem[]) => writeJSON(GUEST_KEY, items);
const guestId = (prodVarId: number) => `guest-${prodVarId}`;
const fromGuestId = (id: number | string) => Number(String(id).replace('guest-', ''));

async function guestLines(): Promise<CartLine[]> {
  const items = readGuest();
  if (items.length === 0) return [];
  const variants = await productService.getVariants(items.map((i) => i.prod_var_id));
  return items.flatMap((item) => {
    const variant = variants.find((v) => v.prod_var_id === item.prod_var_id);
    if (!variant) return [];
    return [{ cart_item_id: guestId(item.prod_var_id), prod_var_id: item.prod_var_id, quantity: item.quantity, variant }];
  });
}

export const cartService = {
  getItems(loggedIn: boolean) {
    return loggedIn ? http<CartLine[]>('/cart') : guestLines();
  },

  addItem(loggedIn: boolean, prodVarId: number, quantity: number, stocks: number) {
    if (loggedIn) {
      return http<CartLine[]>('/cart/items', { method: 'POST', body: { prod_var_id: prodVarId, quantity } });
    }
    const items = readGuest();
    const row = items.find((i) => i.prod_var_id === prodVarId);
    if (row) row.quantity = Math.min(row.quantity + quantity, stocks);
    else items.push({ prod_var_id: prodVarId, quantity: Math.min(quantity, stocks) });
    writeGuest(items);
    return guestLines();
  },

  updateQuantity(loggedIn: boolean, cartItemId: number | string, quantity: number, stocks: number) {
    if (loggedIn) {
      return http<CartLine[]>(`/cart/items/${cartItemId}`, { method: 'PATCH', body: { quantity } });
    }
    const items = readGuest();
    const row = items.find((i) => i.prod_var_id === fromGuestId(cartItemId));
    if (row) row.quantity = Math.max(1, Math.min(quantity, stocks));
    writeGuest(items);
    return guestLines();
  },

  removeItem(loggedIn: boolean, cartItemId: number | string) {
    if (loggedIn) {
      return http<CartLine[]>(`/cart/items/${cartItemId}`, { method: 'DELETE' });
    }
    writeGuest(readGuest().filter((i) => i.prod_var_id !== fromGuestId(cartItemId)));
    return guestLines();
  },

  // call right after login
  async mergeGuestCart() {
    const items = readGuest();
    if (items.length === 0) return http<CartLine[]>('/cart');
    const lines = await http<CartLine[]>('/cart/merge', { method: 'POST', body: { items } });
    removeKey(GUEST_KEY);
    return lines;
  },

  async clear(loggedIn: boolean) {
    if (loggedIn) return http<void>('/cart', { method: 'DELETE' });
    removeKey(GUEST_KEY);
  },
};
