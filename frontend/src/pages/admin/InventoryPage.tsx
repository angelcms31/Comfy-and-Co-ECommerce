import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import PriceTag from '@/components/ui/PriceTag';
import Table, { type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { LOW_STOCK_LIMIT } from '@/lib/constants';
import { firstImage } from '@/lib/images';
import { displayVariant } from '@/lib/product';
import { isSuperAdmin } from '@/lib/roles';
import { cn } from '@/lib/cn';
import type { ProductWithVariants } from '@/types/models';
import AdminPageHeader from './AdminPageHeader';
import { FilterPills, SearchBox } from './AdminUi';
import ProductFormModal from './ProductFormModal';

type StockStatus = 'in' | 'low' | 'out';
type View = 'active' | 'archived';

const PAGE_SIZE = 10;

const STATUS: Record<StockStatus, { label: string; className: string }> = {
  in: { label: 'In Stock', className: 'bg-mint text-forest' },
  low: { label: 'Low Stock', className: 'bg-pending text-pending-text' },
  out: { label: 'Out of Stock', className: 'bg-coral text-white' },
};

// one row per product, stock is all its variants together
const totalStock = (p: ProductWithVariants) => p.variants.reduce((n, v) => n + v.stocks, 0);
function stockStatus(p: ProductWithVariants): StockStatus {
  const stock = totalStock(p);
  if (stock <= 0) return 'out';
  if (stock <= LOW_STOCK_LIMIT) return 'low';
  return 'in';
}

export default function InventoryPage() {
  const toast = useToast();
  const { user } = useAuth();
  const products = useAsync(() => productService.getAll({ includeUnavailable: true }), []);
  const categories = useAsync(() => categoryService.getAll(), []);

  const [view, setView] = useState<View>('active');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<StockStatus | ''>('');
  const [editing, setEditing] = useState<ProductWithVariants | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState<{ product: ProductWithVariants; action: 'archive' | 'restore' | 'delete' } | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products.data ?? []).filter(
      (p) =>
        (view === 'archived' ? !p.is_avail : p.is_avail) &&
        (!categoryId || p.item_categ_id === Number(categoryId)) &&
        (!status || stockStatus(p) === status) &&
        (!q || [p.product_name, p.category.item_category, ...p.variants.map((v) => v.sku)].some((t) => t.toLowerCase().includes(q))),
    );
  }, [products.data, view, search, categoryId, status]);

  // back to page 1 when the filter changes, and stay in range when rows move to the other tab
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [view, search, categoryId, status]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openForm = (product: ProductWithVariants | null) => {
    setEditing(product);
    setFormOpen(true);
  };

  const confirm = async () => {
    if (!confirming) return;
    const { product, action } = confirming;
    setBusy(true);
    try {
      if (action === 'delete') await productService.remove(product.product_id);
      else await productService.archive(product.product_id, action === 'archive');
      toast.success(`${product.product_name} ${action === 'archive' ? 'archived' : action === 'restore' ? 'restored' : 'deleted'}`);
      setConfirming(null);
      products.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<ProductWithVariants>[] = [
    {
      key: 'photo',
      header: 'Photo',
      render: (p) => (
        <div className="size-11 overflow-hidden rounded-lg bg-cream">
          <img src={firstImage(displayVariant(p)?.images ?? null)} alt="" className="size-full object-contain p-1" />
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Product Name',
      render: (p) => (
        <div className="min-w-40">
          <p className="font-medium text-ink">{p.product_name}</p>
          <p className="text-xs text-muted">
            {p.variants.length} variant{p.variants.length === 1 ? '' : 's'} · {p.variants[0]?.sku}
          </p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (p) => p.category.item_category },
    { key: 'price', header: 'Price', render: (p) => (displayVariant(p) ? <PriceTag variant={displayVariant(p)!} size="sm" /> : '–') },
    { key: 'stock', header: 'Stock', render: (p) => <span className="tabular-nums">{totalStock(p)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <span className={cn('inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS[stockStatus(p)].className)}>
          {STATUS[stockStatus(p)].label}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (p) => (
        <div className="flex justify-end gap-3 text-sm font-medium">
          <button onClick={() => openForm(p)} className="text-coral-dark hover:underline">
            Edit
          </button>
          {view === 'active' ? (
            <button onClick={() => setConfirming({ product: p, action: 'archive' })} className="text-ink hover:underline">
              Archive
            </button>
          ) : (
            <>
              <button onClick={() => setConfirming({ product: p, action: 'restore' })} className="text-forest hover:underline">
                Restore
              </button>
              {isSuperAdmin(user) && (
                <button onClick={() => setConfirming({ product: p, action: 'delete' })} className="text-coral-dark hover:underline">
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  const archivedCount = (products.data ?? []).filter((p) => !p.is_avail).length;

  return (
    <>
      <AdminPageHeader title="Inventory" subtitle="Manage products, prices, and stock levels." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Search products..." className="w-full sm:w-56" />
        <div className="w-44">
          <Select aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-10 rounded-full !py-0">
            <option value="">Category: All</option>
            {categories.data?.map((c) => (
              <option key={c.item_categ_id} value={c.item_categ_id}>
                {c.item_category}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-48">
          <Select aria-label="Stock status" value={status} onChange={(e) => setStatus(e.target.value as StockStatus | '')} className="h-10 rounded-full !py-0">
            <option value="">Stock Status: All</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </Select>
        </div>
        <Button onClick={() => openForm(null)} disabled={!categories.data} className="sm:ml-auto">
          <Plus className="size-4" /> Add Product
        </Button>
      </div>

      <FilterPills
        value={view}
        onChange={setView}
        options={[
          { value: 'active', label: 'Active' },
          { value: 'archived', label: `Archived${archivedCount ? ` (${archivedCount})` : ''}` },
        ]}
      />
      <p className="mb-3 mt-2 text-xs text-muted">
        Archive hides products from the storefront without deleting records. Archived products can be restored.
      </p>

      <section className="rounded-card border border-line bg-white p-2 sm:p-3">
        {products.loading && <LoadingState label="Loading products..." layout="table" />}
        {products.error && <ErrorState message={products.error} onRetry={products.reload} />}
        {products.data && rows.length === 0 && (
          <EmptyState
            title={view === 'archived' ? 'No archived products' : products.data.length === 0 ? 'No products yet' : 'No matching products'}
            message={view === 'archived' ? 'Products you archive show up here.' : 'Try another search or filter.'}
          />
        )}
        {rows.length > 0 && (
          <>
            <Table columns={columns} rows={pageRows} rowKey={(p) => p.product_id} />
            <div className="border-t border-line">
              <Pagination page={currentPage} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />
            </div>
          </>
        )}
      </section>

      <ProductFormModal
        open={formOpen}
        product={editing}
        categories={categories.data ?? []}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          products.reload();
        }}
      />

      <ConfirmDialog
        open={!!confirming}
        title={confirming?.action === 'archive' ? 'Archive product?' : confirming?.action === 'restore' ? 'Restore product?' : 'Delete product?'}
        danger={confirming?.action !== 'restore'}
        loading={busy}
        confirmLabel={confirming?.action === 'archive' ? 'Archive' : confirming?.action === 'restore' ? 'Restore' : 'Delete forever'}
        onCancel={() => setConfirming(null)}
        onConfirm={confirm}
        message={
          confirming && (
            <>
              <strong className="text-ink">{confirming.product.product_name}</strong>
              {confirming.action === 'archive' && " will be hidden from the store. Past orders keep their details, and you can restore it anytime."}
              {confirming.action === 'restore' && ' will show in the store again.'}
              {confirming.action === 'delete' && ' and all its variants will be deleted for good. Past orders keep their item names and prices.'}
            </>
          )
        }
      />
    </>
  );
}
