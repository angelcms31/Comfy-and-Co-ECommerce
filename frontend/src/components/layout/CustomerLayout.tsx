import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { BOTTOM_NAV_SPACE } from './BottomNav';
import Header from './Header';
import Footer from './Footer';

export default function CustomerLayout() {
  const { pathname } = useLocation();

  // start each new page at the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={cn('flex min-h-screen flex-col', BOTTOM_NAV_SPACE)}>
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
