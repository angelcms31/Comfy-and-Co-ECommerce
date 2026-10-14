import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/ui/Input';
import ProductGrid from '@/components/ui/ProductGrid';
import { EmptyState } from '@/components/ui/States';
import { COLLECTIONS } from '@/lib/constants';
import { useAsync } from '@/hooks/useAsync';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { cn } from '@/lib/cn';
import type { Collection, ProductSort } from '@/types/models';

const SORTS: { value: ProductSort | ''; label: string }[] = [
  { value: '', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name: A to Z' },
];

const toNumber = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);

function FilterOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-mint font-medium text-forest' : 'text-ink hover:bg-white',
      )}
    >
      {children}
    </button>
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
    update({ min: minInput, max: maxInput });
    setFiltersOpen(false);
  };

  const categoryName = categories.data?.find((c) => c.item_categ_id === categoryId)?.item_category;
  const collectionName = COLLECTIONS.find((c) => c.value === collection)?.label;
  const title = q ? `Results for "${q}"` : categoryName ?? (collection !== 'all' ? collectionName : 'All products');
  const hasFilters = !!(q || categoryId || collection !== 'all' || minPrice || maxPrice);

  const filters = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 px-3 font-sans text-xs font-semibold uppercase tracking-wide text-muted">Category</h3>
        <FilterOption active={!categoryId} onClick={() => update({ category: undefined })}>
          All categories
        </FilterOption>
        {categories.data?.map((c) => (
          <FilterOption key={c.item_categ_id} active={categoryId === c.item_categ_id} onClick={() => update({ category: c.item_categ_id })}>
            {c.item_category}
          </FilterOption>
        ))}
        {categories.error && <p className="px-3 text-xs text-muted">Couldn't load categories</p>}
      </div>

      <div>
        <h3 className="mb-2 px-3 font-sans text-xs font-semibold uppercase tracking-wide text-muted">Collection</h3>
        {COLLECTIONS.map((c) => (
          <FilterOption key={c.value} active={collection === c.value} onClick={() => update({ collection: c.value })}>
            {c.label}
          </FilterOption>
        ))}
      </div>

      <form onSubmit={applyPrice} className="space-y-2 px-3">
        <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-muted">Price (₱)</h3>
        <div className="flex items-center gap-2">
          <Input type="number" min={0} inputMode="numeric" placeholder="Min" aria-label="Minimum price" value={minInput} onChange={(e) => setMinInput(e.target.value)} />
          <span className="text-muted">–</span>
          <Input type="number" min={0} inputMode="numeric" placeholder="Max" aria-label="Maximum price" value={maxInput} onChange={(e) => setMaxInput(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="w-full">
          Apply
        </Button>
      </form>
    </div>
  );

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-forest sm:text-4xl">{title}</h1>
          {products.data && (
            <p className="mt-1 text-sm text-muted">
              {products.data.length} {products.data.length === 1 ? 'product' : 'products'}
            </p>
          )}
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" size="md" className="lg:hidden" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
            <SlidersHorizontal className="size-4" /> Filters
          </Button>
          <div className="w-48">
            <Select aria-label="Sort by" value={sort ?? ''} onChange={(e) => update({ sort: e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {hasFilters && (
        <div className="mb-5 flex flex-wrap gap-2">
          {q && <Chip label={`"${q}"`} onRemove={() => update({ q: undefined })} />}
          {categoryName && <Chip label={categoryName} onRemove={() => update({ category: undefined })} />}
          {collection !== 'all' && collectionName && <Chip label={collectionName} onRemove={() => update({ collection: undefined })} />}
          {(minPrice || maxPrice) && (
            <Chip label={`₱${minPrice ?? 0} – ${maxPrice ? `₱${maxPrice}` : 'any'}`} onRemove={() => update({ min: undefined, max: undefined })} />
          )}
          <button className="text-sm text-forest underline" onClick={() => setParams(sort ? { sort } : {})}>
            Clear all
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className={cn('rounded-card bg-butter-light p-3 lg:block lg:self-start', filtersOpen ? 'block' : 'hidden')}>{filters}</aside>
        <ProductGrid
          products={products.data}
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
