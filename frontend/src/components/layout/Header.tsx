import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Heart, Home, LogOut, Menu, Search, ShoppingCart, Store, User, X } from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import { categoryService } from '@/services/categoryService';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { COLLECTIONS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { isAdmin } from '@/lib/roles';
import BottomNav, { BottomTab } from './BottomNav';
import Logo from './Logo';
import SearchBar from './SearchBar';

// Track Order only shows when logged in
const pageLinks = (loggedIn: boolean) => [
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact Us' },
  ...(loggedIn ? [{ to: '/orders', label: 'Track Order' }] : []),
];

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

function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const item = 'block w-full px-4 py-2 text-left hover:bg-cream';
  return (
    <Dropdown
      align="right"
      ariaLabel="Account menu"
      buttonClassName="grid size-10 shrink-0 place-items-center rounded-full bg-mint text-forest transition-colors hover:bg-mint-light sm:size-11"
      label={<span className="font-display text-lg font-semibold">{user.full_name.charAt(0).toUpperCase()}</span>}
    >
      {(close) => (
        <>
          <div className="border-b border-line px-4 pb-2 pt-1.5">
            <p className="truncate font-medium">{user.full_name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          {isAdmin(user) && (
            <Link to="/admin" onClick={close} className={item}>
              Admin dashboard
            </Link>
          )}
          <Link to="/profile" onClick={close} className={item}>
            My profile
          </Link>
          <Link to="/orders" onClick={close} className={item}>
            Track orders
          </Link>
          <Link to="/wishlist" onClick={close} className={item}>
            My wishlist
          </Link>
          <button
            onClick={async () => {
              close();
              await logout();
              navigate('/');
            }}
            className={cn(item, 'flex items-center gap-2 text-coral-dark')}
          >
            <LogOut className="size-4" /> Log out
          </button>
        </>
      )}
    </Dropdown>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname, search } = useLocation();

  // close the menu and search after going to another page
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname, search]);
  const { user } = useAuth();
  const { count } = useCart();
  const categories = useAsync(() => categoryService.getAll(), []);

  const categoryLinks = (categories.data ?? []).map((c) => ({ to: `/products?category=${c.item_categ_id}`, label: c.item_category }));
  const categoryStatus = categories.loading ? 'Loading...' : categories.error ? "Couldn't load categories" : null;

  const account = user ? (
    <AccountMenu />
  ) : (
    <IconLink to="/login" label="Log in">
      <User className="size-5" />
    </IconLink>
  );

  return (
    <header className="sticky top-0 z-30 bg-forest text-white shadow-sm">
      {/* phone + tablet: logo row on top, tabs at the bottom like the Facebook app */}
      <div className="lg:hidden">
        <div className="container-page flex items-center gap-2 py-2.5">
          <Logo showText />
          <button
            onClick={() => setSearchOpen((o) => !o)}
            aria-label="Search"
            aria-expanded={searchOpen}
            className={cn(
              'ml-auto grid size-10 place-items-center rounded-full transition-colors',
              searchOpen ? 'bg-mint text-forest' : 'bg-white/10 hover:bg-white/20',
            )}
          >
            {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
          </button>
          {account}
        </div>
        {searchOpen && (
          <div className="container-page pb-3">
            <SearchBar />
          </div>
        )}
      </div>
      <BottomNav label="Main">
        <BottomTab to="/" label="Home" icon={<Home className="size-6" />} active={!menuOpen && pathname === '/'} />
        <BottomTab to="/products" label="Shop" icon={<Store className="size-6" />} active={!menuOpen && pathname.startsWith('/products')} />
        <BottomTab to="/wishlist" label="Wishlist" icon={<Heart className="size-6" />} active={!menuOpen && pathname === '/wishlist'} />
        <BottomTab to="/cart" label="Cart" badge={count} icon={<ShoppingCart className="size-6" />} active={!menuOpen && pathname === '/cart'} />
        <BottomTab label="Menu" icon={<Menu className="size-6" />} active={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
      </BottomNav>

      {/* desktop */}
      <div className="container-page hidden items-center gap-4 py-3 lg:flex">
        <Logo />
        <SearchBar className="max-w-xl flex-1" />
        <div className="ml-auto flex items-center gap-3">
          <IconLink to="/wishlist" label="Likes">
            <Heart className="size-5" fill="currentColor" />
          </IconLink>
          <IconLink to="/cart" label="Cart" badge={count}>
            <ShoppingCart className="size-5" />
          </IconLink>
          {account}
        </div>
      </div>

      {/* desktop nav */}
      <nav className="container-page hidden items-center gap-4 pb-2.5 text-sm lg:flex">
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
        {pageLinks(!!user).map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => cn('rounded-full px-2 py-1 hover:bg-white/10', isActive && 'bg-white/10')}>
            {l.label}
          </NavLink>
        ))}
      </nav>

      {/* opened by the Menu tab: a panel that slides up above the tab bar */}
      {menuOpen && (
        <div className="fixed inset-0 z-20 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-ink/40" />
          <nav
            aria-label="Menu"
            className="absolute inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] max-h-[70dvh] animate-slide-up overflow-y-auto rounded-t-3xl bg-forest-dark"
          >
          <div className="container-page grid gap-5 py-5 text-sm">
            <div className="mx-auto h-1 w-10 rounded-full bg-white/30" />
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
            <div className="grid grid-cols-2 gap-1">
              {pageLinks(!!user).map((l) => (
                <Link key={l.to} to={l.to} className="rounded-lg px-2 py-1.5 hover:bg-white/10">
                  {l.label}
                </Link>
              ))}
            </div>
            {!user && (
              <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
                <Link to="/login" className="rounded-full bg-mint py-2 text-center font-medium text-forest">
                  Log in
                </Link>
                <Link to="/register" className="rounded-full border border-white/40 py-2 text-center font-medium">
                  Create account
                </Link>
              </div>
            )}
          </div>
          </nav>
        </div>
      )}
    </header>
  );
}
