import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, ShoppingCart } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

type Action = 'cart' | 'likes' | 'buy';

// resolves true when the shopper carries on as a guest, false when they went to sign in or closed it.
// `after` is where signing in leads back to (default: this page)
type Ask = (action: Action, after?: string) => Promise<boolean>;

const SignInPromptContext = createContext<Ask | null>(null);

// once a shopper picks "Continue as guest" they aren't asked again until the browser tab is closed
const GUEST_KEY = 'comfyco.continueAsGuest';
const guestChosen = () => {
  try {
    return sessionStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
};

const COPY: Record<Action, { icon: ReactNode; text: string }> = {
  cart: { icon: <ShoppingCart className="size-7" />, text: 'Sign in to keep your cart on any device, or continue as a guest. Your cart moves to your account when you sign in later.' },
  likes: { icon: <Heart className="size-7" />, text: 'Sign in to keep your Likes on any device, or continue as a guest. Your Likes move to your account when you sign in later.' },
  // an order needs an account, so a guest's Buy Now puts the item in the cart and they sign in when they check out
  buy: { icon: <ShoppingBag className="size-7" />, text: 'Sign in to check out now, or continue as a guest: the item goes to your cart, and you sign in when you are ready to pay.' },
};

// Asked when a guest adds to the cart, taps a heart or presses Buy Now: sign in (and come back), or carry on as a guest.
export function SignInPromptProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [action, setAction] = useState<Action | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const answer = useRef<(guest: boolean) => void>(() => {});

  const ask = useCallback<Ask>((next, back) => {
    // Buy Now always asks: the shopper wanted to check out, so signing in is offered every time
    if (next !== 'buy' && guestChosen()) return Promise.resolve(true);
    setAction(next);
    setAfter(back ?? null);
    return new Promise<boolean>((resolve) => {
      answer.current = resolve;
    });
  }, []);

  const close = (guest: boolean) => {
    setAction(null);
    answer.current(guest);
  };

  const signIn = () => {
    close(false);
    navigate('/login', { state: { from: after ?? location.pathname + location.search } });
  };

  const asGuest = () => {
    try {
      sessionStorage.setItem(GUEST_KEY, '1');
    } catch {
      // storage blocked: they'll just be asked again next time
    }
    close(true);
  };

  const copy = action && COPY[action];

  return (
    <SignInPromptContext.Provider value={ask}>
      {children}
      <Modal open={!!action} onClose={() => close(false)} title="Please sign in" size="sm">
        {copy && (
          <div className="text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-butter text-forest">{copy.icon}</div>
            <p className="mt-3 text-sm text-ink">{copy.text}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={signIn}>Sign in</Button>
              <Button variant="outline" onClick={asGuest}>
                Continue as guest
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </SignInPromptContext.Provider>
  );
}

export function useSignInPrompt() {
  const ctx = useContext(SignInPromptContext);
  if (!ctx) throw new Error('useSignInPrompt must be used inside SignInPromptProvider');
  return ctx;
}
