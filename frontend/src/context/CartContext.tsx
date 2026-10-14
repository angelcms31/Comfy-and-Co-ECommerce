import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { cartService } from '@/services/cartService';
import { useToast } from '@/components/ui/Toast';
import type { ProdVar } from '@/types/db';
import type { CartLine } from '@/types/models';
import { useAuth } from './AuthContext';

interface CartValue {
  lines: CartLine[];
  count: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
  addItem: (variant: Pick<ProdVar, 'prod_var_id' | 'stocks'>, quantity: number) => Promise<boolean>;
  updateQuantity: (line: CartLine, quantity: number) => Promise<void>;
  removeItem: (line: CartLine) => Promise<void>;
}

const CartContext = createContext<CartValue | null>(null);

const message = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const loggedIn = !!user;

  const [lines, setLines] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // load the cart, and merge the guest cart in when someone logs in
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    setLoading(true);
    setError(null);
    (loggedIn ? cartService.mergeGuestCart() : cartService.getItems(false))
      .then((data) => active && setLines(data))
      .catch((err) => active && setError(message(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [loggedIn, authLoading, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const addItem = useCallback<CartValue['addItem']>(
    async (variant, quantity) => {
      const inCart = lines.find((l) => l.prod_var_id === variant.prod_var_id)?.quantity ?? 0;
      if (inCart >= variant.stocks) {
        toast.info('You already have all the available stock in your cart.');
        return false;
      }
      try {
        setLines(await cartService.addItem(loggedIn, variant.prod_var_id, quantity, variant.stocks));
        toast.success('Added to cart');
        return true;
      } catch (err) {
        toast.error(message(err));
        return false;
      }
    },
    [lines, loggedIn, toast],
  );

  const updateQuantity = useCallback<CartValue['updateQuantity']>(
    async (line, quantity) => {
      try {
        setLines(await cartService.updateQuantity(loggedIn, line.cart_item_id, quantity, line.variant.stocks));
      } catch (err) {
        toast.error(message(err));
      }
    },
    [loggedIn, toast],
  );

  const removeItem = useCallback<CartValue['removeItem']>(
    async (line) => {
      try {
        setLines(await cartService.removeItem(loggedIn, line.cart_item_id));
      } catch (err) {
        toast.error(message(err));
      }
    },
    [loggedIn, toast],
  );

  const count = lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <CartContext.Provider value={{ lines, count, loading, error, reload, addItem, updateQuantity, removeItem }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
