import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Mail, Menu, MessageCircle, Package, Settings, ShoppingCart, Star, Store, Truck, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { usePolling } from '@/hooks/usePolling';
import { chatService } from '@/services/chatService';
import { adminService } from '@/services/adminService';
import { cn } from '@/lib/cn';
import { isSuperAdmin, ROLE_LABEL } from '@/lib/roles';
import BottomNav, { BOTTOM_NAV_SPACE, BottomTab } from './BottomNav';
import Logo from './Logo';

const links = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/inventory', label: 'Inventory', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/chats', label: 'Chats', icon: MessageCircle },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/messages', label: 'Messages', icon: Mail },
  { to: '/admin/suppliers', label: 'Suppliers', icon: Truck },
];
const settingsLink = { to: '/admin/settings', label: 'Settings', icon: Settings };

// Settings > Security: log the admin out after this many minutes without clicks or typing
function useInactivityLogout(minutes: number | undefined, onTimeout: () => void) {
  useEffect(() => {
    if (!minutes) return;
    let timer = window.setTimeout(onTimeout, minutes * 60000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onTimeout, minutes * 60000);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes, onTimeout]);
}

// chats waiting for staff with messages nobody opened yet, checked every 30 seconds
function useUnreadChats() {
  const [count, setCount] = useState(0);
  const check = useCallback(() => {
    chatService.adminUnread().then((r) => setCount(r.unread)).catch(() => {});
  }, []);
  const { pathname } = useLocation();
  useEffect(check, [check, pathname]);
  usePolling(check, 30000);
  return count;
}

const CHATS = '/admin/chats';

function Sidebar({ onNavigate, onLogout, unreadChats }: { onNavigate?: () => void; onLogout: () => void; unreadChats: number }) {
  const { user } = useAuth();
  const nav = isSuperAdmin(user) ? [...links, settingsLink] : links;

  return (
    <div className="flex h-full flex-col bg-forest px-4 py-6 text-white">
      <Logo to="/admin" showText className="px-2" />

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {nav.map(({ to, label, icon: Icon, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={'end' in rest}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-mint text-forest' : 'text-white/85 hover:bg-white/10',
              )
            }
          >
            <Icon className="size-5" />
            <span className="flex-1">{label}</span>
            {to === CHATS && unreadChats > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-coral-dark px-1 text-[11px] font-semibold leading-5 text-white">{unreadChats}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <NavLink to="/" className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/10">
        <Store className="size-5" />
        View store
      </NavLink>

      <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint font-display font-semibold text-forest">
          {user?.full_name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w.charAt(0).toUpperCase())
            .join('')}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.full_name}</p>
          <p className="text-xs text-white/60">{user && ROLE_LABEL[user.role]}</p>
        </div>
      </div>
      <button onClick={onLogout} className="mt-3 text-center text-sm text-white/80 underline-offset-2 hover:text-white hover:underline">
        Sign out
      </button>
    </div>
  );
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const settings = useAsync(() => adminService.getSettings(), []);

  const onLogout = useCallback(
    async (notice?: string) => {
      await logout();
      navigate('/admin/login', { replace: true, state: notice ? { notice } : undefined });
    },
    [logout, navigate],
  );
  const onTimeout = useCallback(() => onLogout('You were logged out after being inactive. Please log in again.'), [onLogout]);
  useInactivityLogout(settings.data?.security.inactivity_minutes, onTimeout);

  const unreadChats = useUnreadChats();
  // bottom tabs on phones (the rest are under Menu): Dashboard, Inventory, Orders, Chats, then Settings or Reviews
  const tabs = [...links.slice(0, 4), isSuperAdmin(user) ? settingsLink : links[4]];

  return (
    <div className={cn('min-h-screen bg-cream lg:grid lg:grid-cols-[240px_1fr]', BOTTOM_NAV_SPACE)}>
      <aside className="sticky top-0 hidden h-screen lg:block">
        <Sidebar onLogout={() => onLogout()} unreadChats={unreadChats} />
      </aside>

      {/* phone + tablet: title on top, tabs at the bottom, Menu opens the sidebar */}
      <div className="sticky top-0 z-30 flex items-center gap-2 bg-forest px-4 py-3 text-white lg:hidden">
        <Logo to="/admin" className="[&_img]:size-8" />
        <span className="font-display text-lg font-semibold">comfy&amp;co admin</span>
      </div>
      <BottomNav label="Admin">
        {tabs.map(({ to, label, icon: Icon, ...rest }) => (
          <BottomTab
            key={to}
            to={to}
            label={label}
            icon={<Icon className="size-6" />}
            badge={to === CHATS ? unreadChats : undefined}
            active={!open && ('end' in rest ? pathname === to : pathname.startsWith(to))}
          />
        ))}
        <BottomTab label="Menu" icon={<Menu className="size-6" />} active={open} onClick={() => setOpen((o) => !o)} />
      </BottomNav>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="relative h-full w-64">
            <Sidebar onNavigate={() => setOpen(false)} onLogout={() => onLogout()} unreadChats={unreadChats} />
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
