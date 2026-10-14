import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { wishlistService } from '@/services/wishlistService';
import { useToast } from '@/components/ui/Toast';
import type { WishlistLine } from '@/types/models';
import { useAuth } from './AuthContext';

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
  const navigate = useNavigate();
  const location = useLocation();

  const [items, setItems] = useState<WishlistLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    wishlistService
      .getItems()
      .then((data) => active && setItems(data))
      .catch((err) => active && setError(message(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user, authLoading, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const has = useCallback((prodVarId: number) => items.some((i) => i.prod_var_id === prodVarId), [items]);

  const toggle = useCallback(
    async (prodVarId: number) => {
      // wishlist_col needs a user, so guests are sent to log in first
      if (!user) {
        toast.info('Log in to save items to your Likes.');
        navigate('/login', { state: { from: location.pathname + location.search } });
        return;
      }
      const existing = items.find((i) => i.prod_var_id === prodVarId);
      try {
        if (existing) {
          setItems(await wishlistService.remove(existing.wishlist_item_id));
          toast.info('Removed from Likes');
        } else {
          setItems(await wishlistService.add(prodVarId));
          toast.success('Saved to Likes');
        }
      } catch (err) {
        toast.error(message(err));
      }
    },
    [user, items, toast, navigate, location],
  );

  const remove = useCallback(
    async (wishlistItemId: number) => {
      try {
        setItems(await wishlistService.remove(wishlistItemId));
      } catch (err) {
        toast.error(message(err));
      }
    },
    [toast],
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
