import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Input';
import PriceTag from '@/components/ui/PriceTag';
import Table, { type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/hooks/useAsync';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { LOW_STOCK_LIMIT } from '@/lib/constants';
import { firstImage } from '@/lib/images';
import { cn } from '@/lib/cn';
import type { ProdVar } from '@/types/db';
import type { ProductWithVariants } from '@/types/models';
import AdminPageHeader from './AdminPageHeader';
import ProductFormModal from './ProductFormModal';

type StockStatus = 'in' | 'low' | 'out' | 'hidden';

const STATUS: Record<StockStatus, { label: string; className: string }> = {
  in: { label: 'In Stock', className: 'bg-mint text-forest' },
  low: { label: 'Low Stock', className: 'bg-pending text-pending-text' },
  out: { label: 'Out of Stock', className: 'bg-cancelled text-cancelled-text' },
  hidden: { label: 'Hidden', className: 'bg-line text-muted' },
};

interface Row {
  product: ProductWithVariants;
  variant: ProdVar;
  status: StockStatus;
}

function stockStatus(product: ProductWithVariants, v: ProdVar): StockStatus {
  if (!product.is_avail || !v.is_avail) return 'hidden';
  if (v.stocks <= 0) return 'out';
  if (v.stocks <= LOW_STOCK_LIMIT) return 'low';
  return 'in';
}

export default function InventoryPage() {
  const toast = useToast();
  const products = useAsync(() => productService.getAll({ includeUnavailable: true }), []);
  const categories = useAsync(() => categoryService.getAll(), []);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StockStatus | ''>('');
  const [editing, setEditing] = useState<ProductWithVariants | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const rows = useMemo(() => {
    const all: Row[] = (products.data ?? []).flatMap((product) =>
      product.variants.map((variant) => ({ product, variant, status: stockStatus(product, variant) })),
    );
    const q = search.trim().toLowerCase();
    return all.filter(
      (r) =>
        (!status || r.status === status) &&
        (!q || [r.variant.prod_var_name, r.variant.sku, r.product.category.item_category].some((t) => t.toLowerCase().includes(q))),
    );
  }, [products.data, search, status]);

  const openForm = (product: ProductWithVariants | null) => {
    setEditing(product);
    setFormOpen(true);
  };

  // a row is one variant: remove just that variant, or the whole product if it's the last one
  const confirmDelete = async () => {
    if (!deleting) return;
    const { product, variant } = deleting;
    setDeleteBusy(true);
    try {
      if (product.variants.length === 1) {
        await productService.remove(product.product_id);
      } else {
        await productService.update(product.product_id, {
          item_categ_id: product.item_categ_id,
          product_name: product.product_name,
          prod_desc: product.prod_desc,
          is_avail: product.is_avail,
          variants: product.variants.filter((v) => v.prod_var_id !== variant.prod_var_id),
        });
      }
      toast.success(`${variant.prod_var_name} deleted`);
      setDeleting(null);
      products.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Row>[] = [
    {
      key: 'photo',
      header: 'Photo',
      render: (r) => (
        <div className="size-11 overflow-hidden rounded-lg bg-cream">
          <img src={firstImage(r.variant.images)} alt="" className="size-full object-contain p-1" />
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Product Name',
      render: (r) => (
        <div className="min-w-40">
          <p className="font-medium text-ink">{r.variant.prod_var_name}</p>
          <p className="text-xs text-muted">SKU: {r.variant.sku}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (r) => r.product.category.item_category },
    { key: 'price', header: 'Price', render: (r) => <PriceTag variant={r.variant} size="sm" /> },
    { key: 'stock', header: 'Stock', render: (r) => <span className="tabular-nums">{r.variant.stocks}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span className={cn('inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS[r.status].className)}>
          {STATUS[r.status].label}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-3 text-sm font-medium">
          <button onClick={() => openForm(r.product)} className="text-forest hover:underline">
            Edit
          </button>
          <button onClick={() => setDeleting(r)} className="text-coral-dark hover:underline">
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        subtitle="Manage products, prices, and stock levels."
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                aria-label="Search products"
                className="h-10 w-56 rounded-full border border-line bg-white pl-9 pr-3 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-mint"
              />
            </div>
            <div className="w-48">
              <Select aria-label="Stock status" value={status} onChange={(e) => setStatus(e.target.value as StockStatus | '')} className="h-10 rounded-full py-0">
                <option value="">Stock: All Status</option>
                <option value="in">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
                <option value="hidden">Hidden</option>
              </Select>
            </div>
            <Button onClick={() => openForm(null)} disabled={!categories.data}>
              <Plus className="size-4" /> Add Product
            </Button>
          </>
        }
      />

      <section className="rounded-card bg-white p-2 shadow-card sm:p-3">
        {products.loading && <LoadingState label="Loading products..." />}
        {products.error && <ErrorState message={products.error} onRetry={products.reload} />}
        {products.data && rows.length === 0 && (
          <EmptyState
            title={products.data.length === 0 ? 'No products yet' : 'No matching products'}
            message={products.data.length === 0 ? 'Add your first product to start selling.' : 'Try another search or status.'}
          />
        )}
        {rows.length > 0 && <Table columns={columns} rows={rows} rowKey={(r) => r.variant.prod_var_id} />}
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
        open={!!deleting}
        title="Delete product?"
        danger
        loading={deleteBusy}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        message={
          deleting && (
            <>
              <strong className="text-ink">{deleting.variant.prod_var_name}</strong> ({deleting.variant.sku}) will be removed from the store.
              {deleting.product.variants.length === 1
                ? ' This is its only variant, so the whole product will be deleted.'
                : ` The other ${deleting.product.variants.length - 1} variant(s) stay.`}{' '}
              Past orders keep their details.
            </>
          )
        }
      />
    </>
  );
}
