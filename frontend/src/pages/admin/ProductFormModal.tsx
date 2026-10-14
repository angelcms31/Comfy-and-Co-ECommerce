import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input, { Select, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { productService } from '@/services/productService';
import { parseImages } from '@/lib/images';
import type { ItemCateg } from '@/types/db';
import type { ProductInput, ProductWithVariants } from '@/types/models';
import ImageDropzone from './ImageDropzone';

interface VariantForm {
  key: number;
  prod_var_id?: number;
  prod_attr: string;
  sku: string;
  b_price: string;
  pr_price: string;
  pr_start: string;
  pr_end: string;
  stocks: string;
  is_avail: boolean;
  images: string[];
  showSale: boolean;
}

let nextKey = 1;

const emptyVariant = (): VariantForm => ({
  key: nextKey++,
  prod_attr: '',
  sku: '',
  b_price: '',
  pr_price: '',
  pr_start: '',
  pr_end: '',
  stocks: '',
  is_avail: true,
  images: [],
  showSale: false,
});

function toForm(p: ProductWithVariants | null) {
  return {
    product_name: p?.product_name ?? '',
    item_categ_id: p ? String(p.item_categ_id) : '',
    prod_desc: p?.prod_desc ?? '',
    is_avail: p?.is_avail ?? true,
    variants: p
      ? p.variants.map((v) => ({
          key: nextKey++,
          prod_var_id: v.prod_var_id,
          prod_attr: v.prod_attr,
          sku: v.sku,
          b_price: String(v.b_price),
          pr_price: v.pr_price != null ? String(v.pr_price) : '',
          pr_start: v.pr_start ?? '',
          pr_end: v.pr_end ?? '',
          stocks: String(v.stocks),
          is_avail: v.is_avail,
          images: parseImages(v.images),
          showSale: v.pr_price != null,
        }))
      : [emptyVariant()],
  };
}

type Form = ReturnType<typeof toForm>;
type Errors = Record<string, string>;

function validate(form: Form): Errors {
  const e: Errors = {};
  if (!form.product_name.trim()) e.product_name = 'Enter a product name';
  if (!form.item_categ_id) e.item_categ_id = 'Pick a category';

  const skus = new Map<string, number>();
  form.variants.forEach((v, i) => {
    const sku = v.sku.trim().toUpperCase();
    if (!sku) e[`${i}.sku`] = 'Required';
    else if (skus.has(sku)) e[`${i}.sku`] = 'Already used above';
    skus.set(sku, i);

    if (form.variants.length > 1 && !v.prod_attr.trim()) e[`${i}.prod_attr`] = 'Needed when there are 2+ variants';
    if (v.b_price === '' || Number(v.b_price) < 0) e[`${i}.b_price`] = 'Enter a price';
    if (v.stocks === '' || Number(v.stocks) < 0 || !Number.isInteger(Number(v.stocks))) e[`${i}.stocks`] = 'Whole number, 0 or more';

    if (v.showSale && v.pr_price !== '') {
      if (Number(v.pr_price) >= Number(v.b_price)) e[`${i}.pr_price`] = 'Must be lower than the price';
      if (!v.pr_start) e[`${i}.pr_start`] = 'Required';
      if (!v.pr_end) e[`${i}.pr_end`] = 'Required';
      else if (v.pr_start && v.pr_end < v.pr_start) e[`${i}.pr_end`] = 'Must be after the start';
    }
  });
  return e;
}

function toInput(form: Form): ProductInput {
  const name = form.product_name.trim();
  return {
    product_name: name,
    item_categ_id: Number(form.item_categ_id),
    prod_desc: form.prod_desc.trim(),
    is_avail: form.is_avail,
    variants: form.variants.map((v) => {
      const sale = v.showSale && v.pr_price !== '';
      const attr = v.prod_attr.trim();
      return {
        prod_var_id: v.prod_var_id,
        sku: v.sku.trim().toUpperCase(),
        prod_var_name: attr ? `${name} - ${attr}` : name,
        prod_attr: attr,
        b_price: Number(v.b_price),
        pr_price: sale ? Number(v.pr_price) : null,
        pr_start: sale ? v.pr_start : null,
        pr_end: sale ? v.pr_end : null,
        stocks: Number(v.stocks),
        is_avail: v.is_avail,
        images: v.images.join(','),
      };
    }),
  };
}

interface Props {
  open: boolean;
  product: ProductWithVariants | null; // null = add new
  categories: ItemCateg[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ProductFormModal({ open, product, categories, onClose, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(product));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(product));
      setErrors({});
    }
  }, [open, product]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setVariant = (i: number, patch: Partial<VariantForm>) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      if (product) await productService.update(product.product_id, toInput(form));
      else await productService.create(toInput(form));
      toast.success(product ? 'Product updated' : 'Product added');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={product ? 'Edit Product' : 'Add New Product'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={saving}>
            Save Product
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Input
          label="Product Name"
          placeholder="e.g. Comfy Sofa"
          filled
          value={form.product_name}
          onChange={(e) => set('product_name', e.target.value)}
          error={errors.product_name}
        />
        <Select label="Category" filled value={form.item_categ_id} onChange={(e) => set('item_categ_id', e.target.value)} error={errors.item_categ_id}>
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.item_categ_id} value={c.item_categ_id}>
              {c.item_category}
            </option>
          ))}
        </Select>
        <Textarea label="Description" filled rows={3} value={form.prod_desc} onChange={(e) => set('prod_desc', e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-forest" checked={form.is_avail} onChange={(e) => set('is_avail', e.target.checked)} />
          Show this product in the store
        </label>

        <div className="space-y-4 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-sans text-sm font-semibold text-ink">Variants</h3>
            <Button size="sm" variant="ghost" onClick={() => set('variants', [...form.variants, emptyVariant()])}>
              <Plus className="size-4" /> Add variant
            </Button>
          </div>

          {form.variants.map((v, i) => (
            <fieldset key={v.key} className="space-y-3 rounded-xl border border-line p-4">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-medium text-forest">Variant {i + 1}</legend>
                {form.variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => set('variants', form.variants.filter((_, j) => j !== i))}
                    className="rounded-lg p-1 text-coral-dark hover:bg-cancelled/40"
                    aria-label={`Remove variant ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Color / Option" placeholder="e.g. Brown" filled value={v.prod_attr} onChange={(e) => setVariant(i, { prod_attr: e.target.value })} error={errors[`${i}.prod_attr`]} />
                <Input label="SKU" placeholder="e.g. SOF-001-BRO" filled value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} error={errors[`${i}.sku`]} />
                <Input label="Price (₱)" type="number" min={0} step="0.01" inputMode="decimal" placeholder="e.g. 15000" filled value={v.b_price} onChange={(e) => setVariant(i, { b_price: e.target.value })} error={errors[`${i}.b_price`]} />
                <Input label="Stock Quantity" type="number" min={0} step={1} inputMode="numeric" placeholder="e.g. 12" filled value={v.stocks} onChange={(e) => setVariant(i, { stocks: e.target.value })} error={errors[`${i}.stocks`]} />
              </div>

              {v.showSale ? (
                <div className="grid gap-3 rounded-lg bg-butter-light p-3 sm:grid-cols-3">
                  <Input label="Sale price (₱)" type="number" min={0} step="0.01" value={v.pr_price} onChange={(e) => setVariant(i, { pr_price: e.target.value })} error={errors[`${i}.pr_price`]} />
                  <Input label="Starts" type="date" value={v.pr_start} onChange={(e) => setVariant(i, { pr_start: e.target.value })} error={errors[`${i}.pr_start`]} />
                  <Input label="Ends" type="date" value={v.pr_end} onChange={(e) => setVariant(i, { pr_end: e.target.value })} error={errors[`${i}.pr_end`]} />
                  <button
                    type="button"
                    className="text-left text-xs text-coral-dark hover:underline sm:col-span-3"
                    onClick={() => setVariant(i, { showSale: false, pr_price: '', pr_start: '', pr_end: '' })}
                  >
                    Remove sale price
                  </button>
                </div>
              ) : (
                <button type="button" className="text-xs font-medium text-forest hover:underline" onClick={() => setVariant(i, { showSale: true })}>
                  + Add sale price
                </button>
              )}

              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink">Product Images</p>
                <ImageDropzone images={v.images} onChange={(images) => setVariant(i, { images })} />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-forest" checked={v.is_avail} onChange={(e) => setVariant(i, { is_avail: e.target.checked })} />
                Available for sale
              </label>
            </fieldset>
          ))}
        </div>
      </form>
    </Modal>
  );
}
