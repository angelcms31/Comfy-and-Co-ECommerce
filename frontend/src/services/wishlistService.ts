import { http } from '@/lib/http';
import type { WishlistLine } from '@/types/models';

// the backend creates the user's default wishlist_col on first add
export const wishlistService = {
  getItems: () => http<WishlistLine[]>('/wishlist'),
  add: (prodVarId: number) => http<WishlistLine[]>('/wishlist/items', { method: 'POST', body: { prod_var_id: prodVarId } }),
  remove: (wishlistItemId: number) => http<WishlistLine[]>(`/wishlist/items/${wishlistItemId}`, { method: 'DELETE' }),
};
