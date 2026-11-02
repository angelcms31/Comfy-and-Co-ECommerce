import { Link } from 'react-router-dom';
import { COURIERS } from '@/lib/constants';
import { LogoMark } from './Logo';

const explore = [
  { to: '/about', label: 'About us' },
  { to: '/profile', label: 'My profile' },
  { to: '/wishlist', label: 'My wishlist' },
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/privacy', label: 'Privacy Policy' },
];

const badge = 'rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-forest';

export default function Footer() {
  return (
    <footer className="bg-forest text-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr] md:gap-16">
        <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
          <LogoMark className="size-14" />
          <span className="mt-2 font-display text-4xl font-semibold">comfy&amp;co</span>
          <p className="mt-2 max-w-48 text-sm text-white/90">"Making every corner feel like home."</p>
        </div>

        <div className="text-center sm:text-left">
          <h3 className="mb-3 font-sans text-sm font-semibold">Explore</h3>
          <ul className="space-y-2 text-sm text-white/80">
            {explore.map((l) => (
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
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className={badge}>GCash</span>
            <span className={badge}>Cash on Delivery</span>
          </div>
          <h3 className="mb-3 mt-6 font-sans text-sm font-semibold">Courier Partners</h3>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {COURIERS.map((c) => (
              <span key={c} className={badge}>
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">© {new Date().getFullYear()} comfy&amp;co. All rights reserved.</div>
    </footer>
  );
}
