import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, Package, ShoppingCart, Star, Store, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/cn';
import Logo from './Logo';

const links = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/inventory', label: 'Inventory', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="flex h-full flex-col bg-forest px-4 py-6 text-white">
      <Logo to="/admin" showText className="px-2" />

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-mint text-forest' : 'text-white/85 hover:bg-white/10',
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <NavLink to="/" className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/10">
        <Store className="size-5" />
        View store
      </NavLink>

      <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint font-display font-semibold text-forest">
          {user?.full_name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.full_name}</p>
          <p className="text-xs text-white/60">Store admin</p>
        </div>
        <button onClick={onLogout} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Log out" title="Log out">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">
        <Sidebar />
      </aside>

      {/* small screens */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-forest px-4 py-3 text-white lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-6" />
        </button>
        <span className="font-display text-lg font-semibold">comfy&amp;co admin</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="relative h-full w-64">
            <Sidebar onNavigate={() => setOpen(false)} />
            <button onClick={() => setOpen(false)} className="absolute right-3 top-6 text-white" aria-label="Close menu">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
