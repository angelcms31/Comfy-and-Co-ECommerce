import { http } from '@/lib/http';
import { readJSON, removeKey, writeJSON } from '@/lib/storage';
import type { WishlistLine } from '@/types/models';
import { productService } from './productService';

// Logged in: the backend creates the user's default wishlist_col on first add.
// Guest: the liked variants are kept in localStorage and moved into the account after sign in (like the guest cart).

const GUEST_KEY = 'comfyco.guestLikes';
type GuestLike = { prod_var_id: number; created_at: string };

const readGuest = () => readJSON<GuestLike[]>(GUEST_KEY, []);
const writeGuest = (items: GuestLike[]) => writeJSON(GUEST_KEY, items);

// a guest line has no database row yet, so its id is the variant id made negative (never clashes with a real one)
const guestLineId = (prodVarId: number) => -prodVarId;

async function guestLines(): Promise<WishlistLine[]> {
  const likes = readGuest();
  if (likes.length === 0) return [];
  const variants = await productService.getVariants(likes.map((l) => l.prod_var_id));
  return likes.flatMap((like) => {
    const variant = variants.find((v) => v.prod_var_id === like.prod_var_id);
    if (!variant) return [];
    return [{ wishlist_item_id: guestLineId(like.prod_var_id), wishlist_coll_id: 0, prod_var_id: like.prod_var_id, created_at: like.created_at, variant }];
  });
}

export const wishlistService = {
  getItems: (loggedIn = true) => (loggedIn ? http<WishlistLine[]>('/wishlist') : guestLines()),

  add(prodVarId: number, loggedIn = true) {
    if (loggedIn) return http<WishlistLine[]>('/wishlist/items', { method: 'POST', body: { prod_var_id: prodVarId } });
    const likes = readGuest();
    if (!likes.some((l) => l.prod_var_id === prodVarId)) writeGuest([{ prod_var_id: prodVarId, created_at: new Date().toISOString() }, ...likes]);
    return guestLines();
  },

  remove(wishlistItemId: number, loggedIn = true) {
    if (loggedIn && wishlistItemId > 0) return http<WishlistLine[]>(`/wishlist/items/${wishlistItemId}`, { method: 'DELETE' });
    writeGuest(readGuest().filter((l) => guestLineId(l.prod_var_id) !== wishlistItemId));
    return guestLines();
  },

  // call right after sign in: the guest's Likes are added to the account (ones already there are skipped by the backend)
  async mergeGuestLikes() {
    const likes = readGuest();
    let lines: WishlistLine[] | null = null;
    for (const like of [...likes].reverse()) {
      try {
        lines = await http<WishlistLine[]>('/wishlist/items', { method: 'POST', body: { prod_var_id: like.prod_var_id } });
      } catch {
        // a product that was deleted since: skip it
      }
    }
    removeKey(GUEST_KEY);
    return lines ?? http<WishlistLine[]>('/wishlist');
  },
};
