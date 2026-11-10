import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import PriceTag from '@/components/ui/PriceTag';
import { cn } from '@/lib/cn';
import { firstImage } from '@/lib/images';
import { displayVariant, isBuyable } from '@/lib/product';
import { MAX_SEARCH } from '@/lib/constants';
import { productService } from '@/services/productService';
import type { ProductWithVariants } from '@/types/models';

const MAX_SUGGESTIONS = 6;

// loaded once when the box is first used, then filtered here so suggestions show up right away
let catalog: Promise<ProductWithVariants[]> | null = null;
function loadCatalog() {
  catalog ??= productService.getAll().catch((err) => {
    catalog = null;
    throw err;
  });
  return catalog;
}

// checks the same fields as the search on the products page. Lower is better, null is no match.
function rank(p: ProductWithVariants, term: string) {
  const name = p.product_name.toLowerCase();
  if (` ${name}`.includes(` ${term}`)) return 0;
  if (name.includes(term)) return 1;
  const others = [p.prod_desc ?? '', p.category.item_category, ...p.variants.flatMap((v) => [v.sku, v.prod_attr ?? ''])];
  if (!others.some((t) => t.toLowerCase().includes(term))) return null;
  // "mattress" should put the mattresses before a sheet set that mentions mattresses
  return `${p.category.item_category} ${p._temp_subcategory ?? ''}`.toLowerCase().includes(term) ? 2 : 3;
}

// sold-out products come after the ones in stock, then the best match first
const soldOut = (p: ProductWithVariants) => (p.variants.some(isBuyable) ? 0 : 1);

function suggest(products: ProductWithVariants[], term: string) {
  return products
    .map((product) => ({ product, score: rank(product, term) }))
    .filter((s): s is { product: ProductWithVariants; score: number } => s.score !== null)
    .sort((a, b) => soldOut(a.product) - soldOut(b.product) || a.score - b.score || a.product.product_name.localeCompare(b.product.product_name))
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => s.product);
}

export default function SearchBar({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const urlQ = params.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  useEffect(() => setQ(urlQ), [urlQ]);

  const [products, setProducts] = useState<ProductWithVariants[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();

  const load = () => {
    setFailed(false);
    loadCatalog().then(setProducts).catch(() => setFailed(true));
  };

  const term = q.trim().toLowerCase();
  const suggestions = products && term ? suggest(products, term) : [];
  const showList = open && !!term;
  const searchUrl = term ? `/products?q=${encodeURIComponent(q.trim())}` : '/products';

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const picked = showList ? suggestions[active] : undefined;
    close();
    navigate(picked ? `/products/${picked.product_id}` : searchUrl);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') close();
    if (!showList || !suggestions.length || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault();
    // -1 means nothing is picked, so Enter searches what was typed
    const size = suggestions.length + 1;
    setActive((i) => ((i + 1 + (e.key === 'ArrowDown' ? 1 : -1) + size) % size) - 1);
  };

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className={cn('relative', className)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close();
      }}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        maxLength={MAX_SEARCH}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => {
          load();
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="What product are you looking for?"
        aria-label="Search products"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className="h-11 w-full rounded-full bg-white pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-mint"
      />

      {showList && (
        // keeps focus in the box when clicking, so the list isn't closed before the click lands
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-40 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl bg-white py-2 text-ink shadow-card"
        >
          <ul id={listId} role="listbox" aria-label="Suggested products">
            {suggestions.map((p, i) => {
              const variant = displayVariant(p);
              return (
                <li key={p.product_id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <Link
                    to={`/products/${p.product_id}`}
                    onClick={close}
                    tabIndex={-1}
                    className={cn('flex items-center gap-3 px-3 py-2 transition-colors hover:bg-cream', i === active && 'bg-cream')}
                  >
                    <img src={firstImage(variant?.images)} alt="" className="size-12 shrink-0 rounded-lg bg-cream object-contain" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.product_name}</span>
                      <span className="block truncate text-xs text-muted">{p.category.item_category}</span>
                    </span>
                    {variant && <PriceTag variant={variant} size="sm" className="shrink-0 justify-end" />}
                  </Link>
                </li>
              );
            })}
          </ul>

          {!products && !failed && <p className="px-4 py-3 text-sm text-muted">Looking for products...</p>}
          {products && !suggestions.length && <p className="px-4 py-3 text-sm text-muted">No products found for "{q.trim()}"</p>}
          {!!suggestions.length && (
            <Link
              to={searchUrl}
              onClick={close}
              tabIndex={-1}
              className="mt-1 block truncate border-t border-line px-4 pb-1 pt-2.5 text-sm font-medium text-forest hover:underline"
            >
              See all results for "{q.trim()}"
            </Link>
          )}
          {failed && (
            <Link to={searchUrl} onClick={close} tabIndex={-1} className="block truncate px-4 py-1 text-sm font-medium text-forest hover:underline">
              Search for "{q.trim()}"
            </Link>
          )}
        </div>
      )}
    </form>
  );
}
