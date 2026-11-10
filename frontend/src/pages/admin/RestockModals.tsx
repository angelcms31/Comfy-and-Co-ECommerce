import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, PackageCheck, Plus, Trash2, Truck } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input, { Select, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime } from '@/lib/dates';
import { MAX_SEARCH } from '@/lib/constants';
import { formatPeso } from '@/lib/pricing';
import {
  defectService,
  DEFECT_TYPES,
  isPurchaseOpen,
  purchaseTotal,
  unitsLeft,
  type CategorySupplier,
  type PurchaseOrder,
  type PurchaseStatus,
  type Supplier,
} from '@/services/defectService';
import type { ProductWithVariants } from '@/types/models';

// number boxes only take what they should while typing (a number input still lets "-" and "e" through)
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 5);
const money = (s: string) => {
  const [whole, ...rest] = s.replace(/[^\d.]/g, '').split('.');
  return rest.length ? `${whole.slice(0, 8)}.${rest.join('').slice(0, 2)}` : whole.slice(0, 8);
};

export const PO_STYLE: Record<PurchaseStatus, string> = {
  Ordered: 'bg-butter text-forest',
  'Partly received': 'bg-amber/20 text-amber',
  Received: 'bg-mint text-forest',
  Cancelled: 'bg-line text-muted',
};

export function PoStatus({ status }: { status: PurchaseStatus }) {
  return <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', PO_STYLE[status])}>{status}</span>;
}

interface Line {
  prod_var_id: number;
  quantity: string;
  unit_cost: string;
}

interface CreateProps {
  open: boolean;
  onClose: () => void;
  onSaved: (po: PurchaseOrder) => void;
  products: ProductWithVariants[];
  suppliers: Supplier[];
  categories: CategorySupplier[];
}

// order stock from a supplier: only products in that supplier's categories can be picked
export function PurchaseOrderModal({ open, onClose, onSaved, products, suppliers, categories }: CreateProps) {
  const toast = useToast();
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [expected, setExpected] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const active = suppliers.filter((s) => s.is_active);

  useEffect(() => {
    if (!open) return;
    setSupplierId(active.length === 1 ? String(active[0].supplier_id) : '');
    setLines([]);
    setSearch('');
    setExpected('');
    setNotes('');
    setErrors({});
  }, [open]); // a fresh form each time it opens

  const supplier = suppliers.find((s) => String(s.supplier_id) === supplierId);
  const myCategs = useMemo(() => new Set(categories.filter((c) => c.supplier_id === supplier?.supplier_id).map((c) => c.item_categ_id)), [categories, supplier]);

  // every variant this supplier delivers, for the picker
  const variants = useMemo(
    () =>
      products
        .filter((p) => myCategs.has(p.item_categ_id))
        .flatMap((p) =>
          p.variants.map((v) => ({
            id: v.prod_var_id,
            label: `${p.product_name}${v.prod_attr ? ` – ${v.prod_attr}` : ''}`,
            sku: v.sku,
            stocks: v.stocks,
          })),
        ),
    [products, myCategs],
  );
  const inLines = new Set(lines.map((l) => l.prod_var_id));
  const term = search.trim().toLowerCase();
  const choices = variants.filter((v) => !inLines.has(v.id) && (!term || `${v.label} ${v.sku}`.toLowerCase().includes(term)));

  const addLine = (id: number) => {
    setLines((ls) => [...ls, { prod_var_id: id, quantity: '', unit_cost: '' }]);
    setSearch('');
  };
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const total = lines.every((l) => l.unit_cost !== '') ? lines.reduce((n, l) => n + Number(l.quantity || 0) * Number(l.unit_cost || 0), 0) : null;

  const submit = async () => {
    const found: Record<string, string> = {};
    if (!supplier) found.supplier = 'Pick the supplier';
    if (!lines.length) found.lines = 'Add at least one item';
    lines.forEach((l, i) => {
      const qty = Number(l.quantity);
      if (!Number.isInteger(qty) || qty < 1) found[`qty${i}`] = 'At least 1';
      if (l.unit_cost !== '' && (Number.isNaN(Number(l.unit_cost)) || Number(l.unit_cost) < 0)) found[`cost${i}`] = 'Invalid';
    });
    setErrors(found);
    if (Object.keys(found).length || !supplier) return;

    setBusy(true);
    try {
      const saved = await defectService.createPurchaseOrder({
        supplier_id: supplier.supplier_id,
        expected_date: expected || null,
        notes: notes.trim(),
        items: lines.map((l) => ({ prod_var_id: l.prod_var_id, quantity: Number(l.quantity), unit_cost: l.unit_cost === '' ? null : Number(l.unit_cost) })),
      });
      toast.success(`Restock order #PO-${saved.po_id} created`);
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the restock order');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="New restock order"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Create order
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Supplier"
          value={supplierId}
          onChange={(e) => {
            setSupplierId(e.target.value);
            setLines([]);
          }}
          error={errors.supplier}
        >
          <option value="" disabled>
            Pick the supplier
          </option>
          {active.map((s) => (
            <option key={s.supplier_id} value={s.supplier_id}>
              {s.supplier_name}
              {s.categories.length ? ` (${s.categories.join(', ')})` : ''}
            </option>
          ))}
        </Select>

        {supplier && variants.length === 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-coral/15 px-3 py-2 text-sm text-coral-dark">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {supplier.supplier_name} has no categories yet. Edit the supplier and tick the categories it supplies first.
          </p>
        )}

        {supplier && variants.length > 0 && (
          <div className="space-y-2">
            <Input label="Add items" placeholder="Search product name, color or SKU" maxLength={MAX_SEARCH} value={search} onChange={(e) => setSearch(e.target.value)} error={errors.lines} />
            <Select
              aria-label="Pick an item to add"
              value=""
              onChange={(e) => e.target.value && addLine(Number(e.target.value))}
            >
              <option value="">{choices.length ? `Pick an item to add (${choices.length})` : 'No items match'}</option>
              {choices.slice(0, 200).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} ({v.sku}) · {v.stocks} in stock
                </option>
              ))}
            </Select>
          </div>
        )}

        {lines.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="w-24 px-2 py-2 font-medium">Qty</th>
                  <th className="w-32 px-2 py-2 font-medium">Cost each</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l, i) => {
                  const v = variants.find((x) => x.id === l.prod_var_id);
                  return (
                    <tr key={l.prod_var_id}>
                      <td className="px-3 py-2">
                        <span className="font-medium">{v?.label}</span>
                        <span className="block text-xs text-muted">
                          {v?.sku} · {v?.stocks} in stock
                        </span>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input aria-label="Quantity" inputMode="numeric" placeholder="0" value={l.quantity} onChange={(e) => setLine(i, { quantity: digits(e.target.value) })} error={errors[`qty${i}`]} />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input aria-label="Cost each" inputMode="decimal" placeholder="optional" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: money(e.target.value) })} error={errors[`cost${i}`]} />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="rounded p-1.5 text-muted hover:bg-cream hover:text-coral-dark" aria-label="Remove item">
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-cream text-xs">
                <tr>
                  <td className="px-3 py-2 text-muted">
                    {lines.length} {lines.length === 1 ? 'item' : 'items'} · {lines.reduce((n, l) => n + Number(l.quantity || 0), 0)} units
                  </td>
                  <td colSpan={3} className="px-2 py-2 text-right font-semibold text-ink">
                    {total !== null ? `Total ${formatPeso(total)}` : 'Total: add a cost per item to see it'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Expected delivery (optional)" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          <Textarea label="Notes (optional)" rows={1} maxLength={1000} placeholder="e.g. PO sent by email, 50% deposit paid" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

interface DetailsProps {
  po: PurchaseOrder | null;
  onClose: () => void;
  onChanged: (po: PurchaseOrder) => void;
}

interface ReceiveLine {
  good: string;
  damaged: string;
  defect_type: string;
}

// one restock order: what was ordered, what arrived, and the form to receive the rest
export function PurchaseOrderDetails({ po, onClose, onChanged }: DetailsProps) {
  const toast = useToast();
  const [receiving, setReceiving] = useState(false);
  const [lines, setLines] = useState<Record<number, ReceiveLine>>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    setReceiving(false);
    setLines({});
    setNotes('');
  }, [po?.po_id]);

  if (!po) return null;
  const open = isPurchaseOpen(po);
  const left = unitsLeft(po);
  const total = purchaseTotal(po);
  const ordered = po.items.reduce((n, i) => n + i.quantity, 0);
  const arrived = ordered - left;

  const line = (id: number): ReceiveLine => lines[id] ?? { good: '', damaged: '', defect_type: '' };
  const setLine = (id: number, patch: Partial<ReceiveLine>) => setLines((ls) => ({ ...ls, [id]: { ...line(id), ...patch } }));

  // start the receive form with "everything left arrived in good condition", the usual case
  const startReceiving = () => {
    const all: Record<number, ReceiveLine> = {};
    for (const i of po.items) all[i.po_item_id] = { good: String(i.quantity - i.received_qty - i.damaged_qty), damaged: '0', defect_type: '' };
    setLines(all);
    setReceiving(true);
  };

  const receive = async () => {
    const items = po.items.map((i) => {
      const l = line(i.po_item_id);
      return { po_item_id: i.po_item_id, good: Number(l.good || 0), damaged: Number(l.damaged || 0), defect_type: l.defect_type || undefined, remaining: i.quantity - i.received_qty - i.damaged_qty, name: i.item_name };
    });
    for (const it of items) {
      if (!Number.isInteger(it.good) || !Number.isInteger(it.damaged) || it.good < 0 || it.damaged < 0) return toast.error(`Check the numbers for ${it.name}`);
      if (it.good + it.damaged > it.remaining) return toast.error(`Only ${it.remaining} of ${it.name} still to come`);
    }
    if (!items.some((it) => it.good + it.damaged > 0)) return toast.error('Enter how many units arrived');
    setBusy(true);
    try {
      const saved = await defectService.receivePurchaseOrder(po.po_id, {
        items: items.map(({ po_item_id, good, damaged, defect_type }) => ({ po_item_id, good, damaged, defect_type })),
        notes: notes.trim(),
      });
      const good = items.reduce((n, it) => n + it.good, 0);
      const bad = items.reduce((n, it) => n + it.damaged, 0);
      toast.success(`${good} added to stock${bad ? `, ${bad} reported as item issues` : ''}`);
      onChanged(saved);
      setReceiving(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not receive the items');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      onChanged(await defectService.cancelPurchaseOrder(po.po_id));
      toast.success(`Restock order #PO-${po.po_id} cancelled`);
      setCancelling(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel the order');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={`Restock order #PO-${po.po_id}`}
      size="xl"
      footer={
        open ? (
          receiving ? (
            <>
              <Button variant="ghost" onClick={() => setReceiving(false)} disabled={busy}>
                Back
              </Button>
              <Button onClick={receive} loading={busy}>
                <PackageCheck className="size-4" /> Add to stock
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="text-coral-dark" onClick={() => setCancelling(true)} disabled={busy}>
                {po.status === 'Partly received' ? 'Cancel the rest' : 'Cancel order'}
              </Button>
              <Button onClick={startReceiving}>
                <PackageCheck className="size-4" /> Receive items
              </Button>
            </>
          )
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Supplier</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              <Truck className="size-4 text-forest" /> {po.supplier_name}
            </dd>
            <dt className="text-muted">Ordered</dt>
            <dd>
              {formatDateTime(po.created_at)}
              {po.created_by_name && ` by ${po.created_by_name}`}
            </dd>
            <dt className="text-muted">Expected</dt>
            <dd>{po.expected_date ? formatDate(po.expected_date) : <span className="text-muted">–</span>}</dd>
            {po.received_at && (
              <>
                <dt className="text-muted">Completed</dt>
                <dd>{formatDateTime(po.received_at)}</dd>
              </>
            )}
          </dl>
          <div className="text-right">
            <PoStatus status={po.status} />
            <p className="mt-2 text-xs text-muted">
              {arrived} of {ordered} units arrived
            </p>
            {total !== null && <p className="text-xs text-muted">Total {formatPeso(total)}</p>}
          </div>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${ordered ? (arrived / ordered) * 100 : 0}%` }} />
        </div>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-cream text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-2 py-2 text-right font-medium">Ordered</th>
                <th className="px-2 py-2 text-right font-medium">In stock</th>
                <th className="px-2 py-2 text-right font-medium">Damaged</th>
                <th className="px-2 py-2 text-right font-medium">Left</th>
                {receiving && (
                  <>
                    <th className="w-24 px-2 py-2 font-medium">Good now</th>
                    <th className="w-24 px-2 py-2 font-medium">Damaged</th>
                    <th className="w-44 px-2 py-2 font-medium">Issue</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {po.items.map((i) => {
                const remaining = i.quantity - i.received_qty - i.damaged_qty;
                const l = line(i.po_item_id);
                return (
                  <tr key={i.po_item_id} className={cn(remaining === 0 && receiving && 'opacity-50')}>
                    <td className="px-3 py-2">
                      <span className="font-medium">{i.item_name}</span>
                      <span className="block text-xs text-muted">
                        {i.sku}
                        {i.unit_cost !== null && ` · ${formatPeso(i.unit_cost)} each`}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">{i.quantity}</td>
                    <td className="px-2 py-2 text-right text-forest">{i.received_qty}</td>
                    <td className={cn('px-2 py-2 text-right', i.damaged_qty > 0 && 'text-coral-dark')}>{i.damaged_qty}</td>
                    <td className="px-2 py-2 text-right font-semibold">{remaining}</td>
                    {receiving && (
                      <>
                        <td className="px-2 py-1.5">
                          <Input aria-label={`Good units of ${i.item_name}`} inputMode="numeric" value={l.good} disabled={!remaining} onChange={(e) => setLine(i.po_item_id, { good: digits(e.target.value) })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input aria-label={`Damaged units of ${i.item_name}`} inputMode="numeric" value={l.damaged} disabled={!remaining} onChange={(e) => setLine(i.po_item_id, { damaged: digits(e.target.value) })} />
                        </td>
                        <td className="px-2 py-1.5">
                          {Number(l.damaged) > 0 && (
                            <Select aria-label={`What's wrong with ${i.item_name}`} value={l.defect_type} onChange={(e) => setLine(i.po_item_id, { defect_type: e.target.value })}>
                              <option value="">Damaged on delivery</option>
                              {DEFECT_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </Select>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {receiving && (
          <>
            <p className="text-xs text-muted">
              Good units go into stock right away. Damaged units are reported as item issues for {po.supplier_name} and never counted as stock.
            </p>
            <Textarea label="Notes for this delivery (optional)" rows={2} maxLength={1000} placeholder="e.g. delivery receipt no., box 2 crushed" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </>
        )}

        {!receiving && po.notes && <p className="whitespace-pre-line rounded-lg bg-cream px-3 py-2 text-ink">{po.notes}</p>}
      </div>

      <ConfirmDialog
        open={cancelling}
        title={po.status === 'Partly received' ? 'Cancel the remaining units?' : 'Cancel this restock order?'}
        message={
          po.status === 'Partly received'
            ? `The ${left} units still to come will be marked as cancelled. Units already in stock stay.`
            : `Restock order #PO-${po.po_id} to ${po.supplier_name} will be cancelled. Nothing is added to stock.`
        }
        confirmLabel="Yes, cancel"
        danger
        loading={busy}
        onConfirm={cancel}
        onCancel={() => setCancelling(false)}
      />
    </Modal>
  );
}

export function NewRestockButton({ onClick, disabled, size }: { onClick: () => void; disabled?: boolean; size?: 'sm' | 'md' }) {
  return (
    <Button variant="outline" size={size} onClick={onClick} disabled={disabled}>
      <Plus className="size-4" /> New restock order
    </Button>
  );
}
