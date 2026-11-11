import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Heart } from 'lucide-react';
import { wishlistService } from '@/services/wishlistService';
import { useToast } from '@/components/ui/Toast';
import type { WishlistLine } from '@/types/models';
import { useAuth } from './AuthContext';
import { useSignInPrompt } from './SignInPrompt';

interface WishlistValue {
  items: WishlistLine[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  has: (prodVarId: number) => boolean;
  toggle: (prodVarId: number) => Promise<void>;
  remove: (wishlistItemId: number) => Promise<void>;
}

const WishlistContext = createContext<WishlistValue | null>(null);

const message = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const askSignIn = useSignInPrompt();
  const loggedIn = !!user;

  const [items, setItems] = useState<WishlistLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    // signed in: the saved Likes, with any guest Likes moved in first. Guest: the Likes kept in this browser
    let active = true;
    setLoading(true);
    setError(null);
    (loggedIn ? wishlistService.mergeGuestLikes() : wishlistService.getItems(false))
      .then((data) => active && setItems(data))
      .catch((err) => active && setError(message(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [loggedIn, authLoading, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const has = useCallback((prodVarId: number) => items.some((i) => i.prod_var_id === prodVarId), [items]);

  const toggle = useCallback(
    async (prodVarId: number) => {
      const existing = items.find((i) => i.prod_var_id === prodVarId);
      // a guest liking something chooses first: sign in, or keep the Likes in this browser
      if (!loggedIn && !existing && !(await askSignIn('likes'))) return;
      try {
        if (existing) {
          setItems(await wishlistService.remove(existing.wishlist_item_id, loggedIn));
          toast.success('Product removed from My Wishlist');
        } else {
          setItems(await wishlistService.add(prodVarId, loggedIn));
          toast.success('Product saved to My Wishlist', <Heart className="size-7" fill="currentColor" />);
        }
      } catch (err) {
        toast.error(message(err));
      }
    },
    [loggedIn, items, toast, askSignIn],
  );

  const remove = useCallback(
    async (wishlistItemId: number) => {
      try {
        setItems(await wishlistService.remove(wishlistItemId, loggedIn));
      } catch (err) {
        toast.error(message(err));
      }
    },
    [toast, loggedIn],
  );

  return (
    <WishlistContext.Provider value={{ items, loading, error, reload, has, toggle, remove }}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
