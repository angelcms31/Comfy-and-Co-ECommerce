import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, Menu, Search, ShoppingCart, User, X } from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import { categoryService } from '@/services/categoryService';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { COLLECTIONS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import Logo from './Logo';

function SearchBar({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const urlQ = params.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  useEffect(() => setQ(urlQ), [urlQ]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : '/products');
  };

  return (
    <form onSubmit={onSubmit} role="search" className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="What product are you looking for?"
        aria-label="Search products"
        className="h-11 w-full rounded-full bg-white pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-mint"
      />
    </form>
  );
}

function IconLink({ to, label, badge, children }: { to: string; label: string; badge?: number; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-label={badge ? `${label} (${badge})` : label}
      className="relative grid size-10 shrink-0 place-items-center rounded-full bg-mint text-forest transition-colors hover:bg-mint-light sm:size-11"
    >
      {children}
      {!!badge && (
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-coral-dark px-1 text-[11px] font-semibold leading-5 text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const { count } = useCart();
  const categories = useAsync(() => categoryService.getAll(), []);

  const categoryLinks = (categories.data ?? []).map((c) => ({ to: `/products?category=${c.item_categ_id}`, label: c.item_category }));
  const categoryStatus = categories.loading ? 'Loading...' : categories.error ? "Couldn't load categories" : null;

  return (
    <header className="sticky top-0 z-30 bg-forest text-white shadow-sm">
      <div className="container-page flex items-center gap-3 py-3 sm:gap-4">
        <button className="-ml-1 rounded-full p-1.5 md:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
          {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
        <Logo />
        <SearchBar className="hidden flex-1 md:block md:max-w-xl" />
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <IconLink to="/wishlist" label="Likes">
            <Heart className="size-5" fill="currentColor" />
          </IconLink>
          <IconLink to="/cart" label="Cart" badge={count}>
            <ShoppingCart className="size-5" />
          </IconLink>
          <IconLink to={user ? '/orders' : '/login'} label={user ? 'My orders' : 'Log in'}>
            {user ? <span className="font-display text-lg font-semibold">{user.full_name.charAt(0).toUpperCase()}</span> : <User className="size-5" />}
          </IconLink>
        </div>
      </div>

      <div className="container-page pb-3 md:hidden">
        <SearchBar />
      </div>

      {/* desktop nav */}
      <nav className="container-page hidden items-center gap-4 pb-2.5 text-sm md:flex">
        <Dropdown label="Categories">
          {(close) =>
            categoryStatus ? (
              <p className="px-4 py-2 text-muted">{categoryStatus}</p>
            ) : (
              categoryLinks.map((c) => (
                <Link key={c.to} to={c.to} onClick={close} className="block px-4 py-2 hover:bg-cream">
                  {c.label}
                </Link>
              ))
            )
          }
        </Dropdown>
        <Dropdown label="Collections">
          {(close) =>
            COLLECTIONS.map((c) => (
              <Link key={c.value} to={`/products?collection=${c.value}`} onClick={close} className="block px-4 py-2 hover:bg-cream">
                {c.label}
              </Link>
            ))
          }
        </Dropdown>
        <NavLink to="/about" className="rounded-full px-2 py-1 hover:bg-white/10">
          About us
        </NavLink>
      </nav>

      {/* mobile menu */}
      {menuOpen && (
        <nav className="border-t border-white/10 bg-forest-dark md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="container-page grid gap-5 py-4 text-sm">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-mint">Categories</p>
              {categoryStatus ? (
                <p className="text-white/70">{categoryStatus}</p>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  {categoryLinks.map((c) => (
                    <Link key={c.to} to={c.to} className="rounded-lg px-2 py-1.5 hover:bg-white/10">
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-mint">Collections</p>
              <div className="grid grid-cols-2 gap-1">
                {COLLECTIONS.map((c) => (
                  <Link key={c.value} to={`/products?collection=${c.value}`} className="rounded-lg px-2 py-1.5 hover:bg-white/10">
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
            <Link to="/about" className="rounded-lg px-2 py-1.5 hover:bg-white/10">
              About us
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
