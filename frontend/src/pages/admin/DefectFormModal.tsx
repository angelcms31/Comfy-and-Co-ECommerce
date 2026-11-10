import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Truck } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input, { Select, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import PhotoPicker from '@/components/ui/PhotoPicker';
import { useToast } from '@/components/ui/Toast';
import { parseImages } from '@/lib/images';
import {
  defectService,
  DEFECT_TYPES,
  SOURCE_LABEL,
  type CategorySupplier,
  type DefectOrder,
  type DefectReport,
  type DefectSource,
  type Supplier,
} from '@/services/defectService';
import { MAX_SEARCH } from '@/lib/constants';
import { uploadService } from '@/services/uploadService';
import type { ProductWithVariants } from '@/types/models';

const OTHER = '__other';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (report: DefectReport) => void;
  products: ProductWithVariants[];
  suppliers: Supplier[];
  categories: CategorySupplier[];
  order: DefectOrder | null; // set when opened from a customer's refund
}

// one defective item: which product, how many, what's wrong. The supplier comes from the product's category.
export default function DefectFormModal({ open, onClose, onSaved, products, suppliers, categories, order }: Props) {
  const toast = useToast();
  const [source, setSource] = useState<DefectSource>('storage');
  const [search, setSearch] = useState('');
  const [varId, setVarId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [type, setType] = useState('');
  const [otherType, setOtherType] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // fresh form each time it opens; from a refund it starts with the order's item, the reason and the customer's photos
  useEffect(() => {
    if (!open) return;
    setSource(order ? 'customer_return' : 'storage');
    setSearch('');
    setVarId(order?.items.length === 1 ? String(order.items[0].prod_var_id) : '');
    setQuantity('1');
    setType('');
    setOtherType('');
    setNotes(order ? [order.reason, order.details].filter(Boolean).join(' – ') : '');
    setPhotos(order ? parseImages(order.photos).slice(0, 5) : []);
    setErrors({});
  }, [open, order]);

  // every variant with its product and category, for the picker
  const variants = useMemo(
    () =>
      products.flatMap((p) =>
        p.variants.map((v) => ({
          id: v.prod_var_id,
          label: `${p.product_name}${v.prod_attr ? ` – ${v.prod_attr}` : ''} (${v.sku})`,
          stocks: v.stocks,
          categId: p.item_categ_id,
          category: p.category.item_category,
        })),
      ),
    [products],
  );
  const term = search.trim().toLowerCase();
  const orderIds = order ? new Set(order.items.map((i) => i.prod_var_id)) : null;
  const choices = variants.filter((v) => (orderIds ? orderIds.has(v.id) : !term || v.label.toLowerCase().includes(term)));
  const picked = variants.find((v) => String(v.id) === varId);
  const orderItem = order?.items.find((i) => String(i.prod_var_id) === varId);

  const categ = picked && categories.find((c) => c.item_categ_id === picked.categId);
  const supplier = categ?.supplier_id ? suppliers.find((s) => s.supplier_id === categ.supplier_id) : undefined;
  const qty = Number(quantity);

  const submit = async () => {
    const found: Record<string, string> = {};
    const defectType = type === OTHER ? otherType.trim() : type;
    if (!picked) found.item = 'Pick the item';
    if (!Number.isInteger(qty) || qty < 1) found.quantity = 'At least 1';
    else if (source === 'storage' && picked && qty > picked.stocks) found.quantity = `Only ${picked.stocks} in stock`;
    else if (orderItem && qty > orderItem.quantity) found.quantity = `The order has ${orderItem.quantity}`;
    if (!defectType) found.type = 'Say what is wrong';
    setErrors(found);
    if (Object.keys(found).length || !picked) return;

    setBusy(true);
    try {
      const saved = await defectService.report({
        prod_var_id: picked.id,
        quantity: qty,
        defect_type: defectType,
        source,
        order_id: order?.order_id ?? null,
        notes: notes.trim(),
        photos,
      });
      toast.success(`Issue #ISS-${saved.defect_id} reported`);
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={order ? `Report item issue from order #${order.order_num}` : 'Report item issue'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={uploading}>
            Save report
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {order ? (
          <p className="rounded-lg bg-cream px-3 py-2 text-sm text-ink">
            Customer return from <span className="font-semibold">{order.customer_name}</span>, order #{order.order_num}
          </p>
        ) : (
          <Select label="Where was it found?" value={source} onChange={(e) => setSource(e.target.value as DefectSource)}>
            <option value="storage">{SOURCE_LABEL.storage} (taken out of stock)</option>
            <option value="receiving">{SOURCE_LABEL.receiving} (not added to stock)</option>
          </Select>
        )}

        <div className="space-y-2">
          {!order && <Input label="Item" placeholder="Search product name, color or SKU" maxLength={MAX_SEARCH} value={search} onChange={(e) => setSearch(e.target.value)} />}
          <Select
            label={order ? 'Item' : undefined}
            aria-label="Pick the item"
            value={varId}
            onChange={(e) => setVarId(e.target.value)}
            error={errors.item}
          >
            <option value="" disabled>
              {choices.length ? `Pick an item (${choices.length})` : 'No items match'}
            </option>
            {choices.slice(0, 200).map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
                {source === 'storage' ? ` · ${v.stocks} in stock` : ''}
              </option>
            ))}
          </Select>
        </div>

        {picked && (
          <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${supplier ? 'bg-mint-light text-forest' : 'bg-coral/15 text-coral-dark'}`}>
            {supplier ? <Truck className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
            {supplier ? (
              <span>
                Supplier: <span className="font-semibold">{supplier.supplier_name}</span> (supplies {picked.category})
              </span>
            ) : (
              <span>
                {picked.category} has no supplier yet, so this report won't count for any supplier. Set one in the Suppliers tab first.
              </span>
            )}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Input label="Quantity" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, '').slice(0, 5))} error={errors.quantity} />
          <div className="space-y-2">
            <Select label="What's wrong?" value={type} onChange={(e) => setType(e.target.value)} error={type === OTHER ? undefined : errors.type}>
              <option value="" disabled>
                Pick the issue
              </option>
              {DEFECT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={OTHER}>Other...</option>
            </Select>
            {type === OTHER && (
              <Input aria-label="Describe the issue" placeholder="Describe the issue" maxLength={80} value={otherType} onChange={(e) => setOtherType(e.target.value)} error={errors.type} />
            )}
          </div>
        </div>

        {source === 'storage' && picked && qty > 0 && qty <= picked.stocks && (
          <p className="text-xs text-muted">
            {qty} will be taken out of stock ({picked.stocks} → {picked.stocks - qty}). They go back in if the supplier replaces them.
          </p>
        )}

        <Textarea label="Notes (optional)" rows={3} maxLength={1000} placeholder="Details for the supplier, e.g. which part is damaged" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <PhotoPicker photos={photos} onChange={setPhotos} upload={uploadService.productImage} max={5} label="Photos (optional, up to 5)" onUploadingChange={setUploading} />
      </div>
    </Modal>
  );
}
