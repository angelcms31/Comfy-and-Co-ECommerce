import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { COURIER } from '@/lib/constants';
import { useStoreInfo } from '@/hooks/useStoreInfo';
import { useAuth } from '@/context/AuthContext';
import { LogoMark } from './Logo';

const explore = [
  { to: '/about', label: 'About us' },
  { to: '/orders', label: 'Track order' },
  { to: '/wishlist', label: 'My wishlist' },
  { to: '/contact', label: 'Contact us' },
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/privacy', label: 'Privacy Policy' },
];

// payment and courier badges share one 2-column grid so every badge is the same width and the rows line up
const badges = 'mx-auto grid max-w-64 grid-cols-2 gap-2 sm:mx-0';
const badge = 'whitespace-nowrap rounded-md bg-white px-2 py-1.5 text-center text-[11px] font-semibold text-forest';

export default function Footer() {
  const { user } = useAuth(); // Track order only shows when logged in
  const store = useStoreInfo();
  return (
    <footer className="bg-forest text-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr] md:gap-16">
        <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
          <LogoMark className="size-14" />
          <span className="mt-2 font-display text-4xl font-semibold">comfy&amp;co</span>
          <p className="mt-2 max-w-48 text-sm text-white/90">"Making every corner feel like home."</p>
          <p className="mt-4 flex max-w-64 items-start gap-1.5 text-left text-xs text-white/70">
            <MapPin className="mt-px size-3.5 shrink-0" />
            {store.address}
          </p>
        </div>

        <div className="text-center sm:text-left">
          <h3 className="mb-3 font-sans text-sm font-semibold">Explore</h3>
          <ul className="space-y-2 text-sm text-white/80">
            {explore.filter((l) => user || l.to !== '/orders').map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center sm:col-span-2 sm:text-left md:col-span-1">
          <h3 className="mb-3 font-sans text-sm font-semibold">Payment Methods</h3>
          <div className={badges}>
            <span className={badge}>GCash</span>
            <span className={badge}>Cash on Delivery</span>
          </div>
          <h3 className="mb-3 mt-6 font-sans text-sm font-semibold">Courier Partners</h3>
          <div className={badges}>
            <span className={badge}>{COURIER}</span>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">© {new Date().getFullYear()} comfy&amp;co. All rights reserved.</div>
    </footer>
  );
}
