import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/ui/Input';
import ProductGrid from '@/components/ui/ProductGrid';
import { EmptyState } from '@/components/ui/States';
import { COLLECTIONS } from '@/lib/constants';
import { useAsync } from '@/hooks/useAsync';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { cn } from '@/lib/cn';
import { isColor, swatch } from '@/lib/colors';
import type { Collection, ProductSort } from '@/types/models';

const SORTS: { value: ProductSort | ''; label: string }[] = [
  { value: '', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name: A to Z' },
];

// digits only, up to 99,999
const priceDigits = (v: string) => v.replace(/\D/g, '').slice(0, 5);

const toNumber = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);

function FilterOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-mint font-medium text-forest' : 'text-ink hover:bg-cream',
      )}
    >
      {children}
      <ChevronRight className="size-3.5 text-muted" />
    </button>
  );
}

// sidebar heading with a line under it, like the mockup
function FilterHeading({ children, onClear }: { children: React.ReactNode; onClear?: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between border-b border-ink/20 pb-1.5">
      <h3 className="font-display text-base font-semibold text-forest">{children}</h3>
      {onClear && (
        <button onClick={onClear} className="text-xs text-muted hover:text-forest">
          Clear
        </button>
      )}
    </div>
  );
}

export default function ProductListPage() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = params.get('q') ?? '';
  const categoryId = toNumber(params.get('category'));
  const collection = (params.get('collection') as Collection | null) ?? 'all';
  const minPrice = toNumber(params.get('min'));
  const maxPrice = toNumber(params.get('max'));
  const sort = (params.get('sort') as ProductSort | null) ?? undefined;
  const color = params.get('color') ?? undefined;
  const sub = params.get('sub') ?? undefined;
  const list = params.get('view') === 'list';

  const categories = useAsync(() => categoryService.getAll(), []);
  const products = useAsync(
    () => productService.getAll({ q, categoryId, collection, minPrice, maxPrice, sort }),
    [q, categoryId, collection, minPrice, maxPrice, sort],
  );

  // price inputs only apply when the form is submitted
  const [minInput, setMinInput] = useState(minPrice?.toString() ?? '');
  const [maxInput, setMaxInput] = useState(maxPrice?.toString() ?? '');
  useEffect(() => {
    setMinInput(minPrice?.toString() ?? '');
    setMaxInput(maxPrice?.toString() ?? '');
  }, [minPrice, maxPrice]);

  const update = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '' || (key === 'collection' && value === 'all')) next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next);
  };

  const applyPrice = (e: FormEvent) => {
    e.preventDefault();
    // typed the wrong way round, so they're swapped instead of showing nothing
    const swap = minInput && maxInput && Number(minInput) > Number(maxInput);
    update({ min: swap ? maxInput : minInput, max: swap ? minInput : maxInput });
    setFiltersOpen(false);
  };

  const categoryName = categories.data?.find((c) => c.item_categ_id === categoryId)?.item_category;
  const collectionName = COLLECTIONS.find((c) => c.value === collection)?.label;
  const subject = q ? `"${q}"` : sub ?? categoryName ?? (collection !== 'all' ? collectionName : undefined);
  const hasFilters = !!(q || categoryId || collection !== 'all' || minPrice || maxPrice || color || sub);

  // subcategory and color aren't API filters, they're applied here to the products the API returned
  const inSub = (products.data ?? []).filter((p) => !sub || p._temp_subcategory === sub);
  const subs = categoryId ? [...new Set((products.data ?? []).map((p) => p._temp_subcategory).filter((s): s is string => !!s))].sort() : [];
  const colors = [...new Set(inSub.flatMap((p) => p.variants.map((v) => v.prod_attr).filter((a) => a && isColor(a))))].sort();
  const shown = products.data && (color ? inSub.filter((p) => p.variants.some((v) => v.prod_attr === color)) : inSub);

  const filters = (
    <div className="space-y-6">
      <div>
        <FilterHeading onClear={categoryId ? () => update({ category: undefined, sub: undefined }) : undefined}>Categories</FilterHeading>
        {categories.data?.map((c) => (
          <div key={c.item_categ_id}>
            <FilterOption active={categoryId === c.item_categ_id && !sub} onClick={() => update({ category: c.item_categ_id, sub: undefined })}>
              {c.item_category}
            </FilterOption>
            {/* subcategories of the selected category */}
            {categoryId === c.item_categ_id && subs.length > 0 && (
              <div className="ml-3 border-l border-line pl-2">
                {subs.map((s) => (
                  <FilterOption key={s} active={sub === s} onClick={() => update({ sub: sub === s ? undefined : s })}>
                    {s}
                  </FilterOption>
                ))}
              </div>
            )}
          </div>
        ))}
        {categories.error && <p className="px-2 text-xs text-muted">Couldn't load categories</p>}
      </div>

      <div>
        <FilterHeading onClear={collection !== 'all' ? () => update({ collection: undefined }) : undefined}>Collections</FilterHeading>
        {COLLECTIONS.filter((c) => c.value !== 'all').map((c) => (
          <FilterOption key={c.value} active={collection === c.value} onClick={() => update({ collection: c.value })}>
            {c.label}
          </FilterOption>
        ))}
      </div>

      <form onSubmit={applyPrice}>
        <FilterHeading onClear={minPrice || maxPrice ? () => update({ min: undefined, max: undefined }) : undefined}>Price</FilterHeading>
        <div className="flex items-end gap-2">
          <Input inputMode="numeric" label="Min" placeholder="₱0" value={minInput} onChange={(e) => setMinInput(priceDigits(e.target.value))} />
          <span className="pb-3 text-muted">–</span>
          <Input inputMode="numeric" label="Max" placeholder="₱99,999" value={maxInput} onChange={(e) => setMaxInput(priceDigits(e.target.value))} />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="mt-2 w-full">
          Apply
        </Button>
      </form>

      {colors.length > 0 && (
        <div>
          <FilterHeading onClear={color ? () => update({ color: undefined }) : undefined}>Color</FilterHeading>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => update({ color: color === c ? undefined : c })}
                title={c}
                aria-label={c}
                aria-pressed={color === c}
                className={cn(
                  'size-7 rounded-md border border-ink/20 transition-transform hover:scale-110',
                  color === c && 'ring-2 ring-forest ring-offset-2',
                )}
                style={{ background: swatch(c) }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const viewButton = (value: 'grid' | 'list', icon: React.ReactNode) => (
    <button
      onClick={() => update({ view: value === 'list' ? 'list' : undefined })}
      aria-label={`${value} view`}
      aria-pressed={list === (value === 'list')}
      className={cn(
        'grid size-9 place-items-center rounded-lg transition-colors',
        list === (value === 'list') ? 'bg-forest text-white' : 'border border-line bg-white text-forest hover:bg-cream',
      )}
    >
      {icon}
    </button>
  );

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className={cn('rounded-card bg-white p-4 shadow-card lg:block lg:self-start lg:bg-transparent lg:p-0 lg:shadow-none', filtersOpen ? 'block' : 'hidden')}>
          {filters}
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {shown ? (
                <>
                  Showing <span className="font-semibold text-ink">{shown.length}</span> {subject ? `result${shown.length === 1 ? '' : 's'} for ` : `product${shown.length === 1 ? '' : 's'}`}
                  {subject && <span className="font-semibold text-ink">{subject}</span>}
                </>
              ) : (
                'Loading products...'
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
                <SlidersHorizontal className="size-4" /> Filters
              </Button>
              <label className="hidden text-sm text-muted sm:block" htmlFor="sort">
                Sort by:
              </label>
              <div className="w-44">
                <Select id="sort" aria-label="Sort by" value={sort ?? ''} onChange={(e) => update({ sort: e.target.value })}>
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              {viewButton('grid', <LayoutGrid className="size-4" />)}
              {viewButton('list', <List className="size-4" />)}
            </div>
          </div>

          {hasFilters && (
            <div className="mb-5 flex flex-wrap gap-2">
              {q && <Chip label={`"${q}"`} onRemove={() => update({ q: undefined })} />}
              {categoryName && <Chip label={categoryName} onRemove={() => update({ category: undefined, sub: undefined })} />}
              {sub && <Chip label={sub} onRemove={() => update({ sub: undefined })} />}
              {collection !== 'all' && collectionName && <Chip label={collectionName} onRemove={() => update({ collection: undefined })} />}
              {(minPrice || maxPrice) && (
                <Chip label={`₱${minPrice ?? 0} – ${maxPrice ? `₱${maxPrice}` : 'any'}`} onRemove={() => update({ min: undefined, max: undefined })} />
              )}
              {color && <Chip label={color} onRemove={() => update({ color: undefined })} />}
              <button className="text-sm text-forest underline" onClick={() => setParams(sort ? { sort } : {})}>
                Clear all
              </button>
            </div>
          )}

        <ProductGrid
          list={list}
          products={shown}
          loading={products.loading}
          error={products.error}
          onRetry={products.reload}
          empty={
            <EmptyState
              title="No products found"
              message={q ? `We couldn't find anything for "${q}". Try another word or remove some filters.` : 'Try removing some filters.'}
            />
          }
        />
        </div>
      </div>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-mint px-3 py-1 text-sm text-forest">
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label}`} className="rounded-full hover:bg-mint-light">
        <X className="size-3.5" />
      </button>
    </span>
  );
}
