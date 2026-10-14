import { Link } from 'react-router-dom';
import { categoryService } from '@/services/categoryService';
import { useAsync } from '@/hooks/useAsync';
import { LogoMark } from './Logo';

export default function Footer() {
  const categories = useAsync(() => categoryService.getAll(), []);

  return (
    <footer className="bg-forest text-white">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1fr_auto_auto] md:gap-16">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <div className="flex items-center gap-3">
            <LogoMark className="size-14" />
            <span className="font-display text-4xl font-semibold sm:text-5xl">comfy&amp;co</span>
          </div>
          <p className="mt-3 font-display text-sm italic text-white/90">"Making every corner feel like home"</p>
        </div>

        <div className="text-center md:text-left">
          <h3 className="mb-3 font-sans text-sm font-semibold text-mint">Explore</h3>
          <ul className="space-y-2 text-sm text-white/85">
            <li><Link to="/about" className="hover:text-white">About Us</Link></li>
            <li><Link to="/terms" className="hover:text-white">Terms &amp; Conditions</Link></li>
            <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
          </ul>
        </div>

        {categories.data && categories.data.length > 0 && (
          <div className="text-center md:text-left">
            <h3 className="mb-3 font-sans text-sm font-semibold text-mint">Categories</h3>
            <ul className="space-y-2 text-sm text-white/85">
              {categories.data.map((c) => (
                <li key={c.item_categ_id}>
                  <Link to={`/products?category=${c.item_categ_id}`} className="hover:text-white">
                    {c.item_category}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} Comfy&amp;Co · Manila, Philippines
      </div>
    </footer>
  );
}
