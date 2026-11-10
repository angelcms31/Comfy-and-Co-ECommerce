import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ClipboardList, Images, PackageX, Pencil, Plus, Truck } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input, { Select, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Table, { type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/hooks/useAsync';
import { cn } from '@/lib/cn';
import { emailError } from '@/lib/email';
import { formatDate, formatDateTime } from '@/lib/dates';
import { parseImages } from '@/lib/images';
import { formatPeso } from '@/lib/pricing';
import {
  defectService,
  DEFECT_NEXT,
  HIGH_DEFECT_RATE,
  isPurchaseOpen,
  purchaseTotal,
  SOURCE_LABEL,
  unitsLeft,
  type CategorySupplier,
  type DefectOrder,
  type DefectReport,
  type DefectStatus,
  type PurchaseOrder,
  type Supplier,
  type SupplierInput,
} from '@/services/defectService';
import { productService } from '@/services/productService';
import AdminPageHeader from './AdminPageHeader';
import { Card, FilterPills, SearchBox, StatCard } from './AdminUi';
import DefectFormModal from './DefectFormModal';
import { NewRestockButton, PoStatus, PurchaseOrderDetails, PurchaseOrderModal } from './RestockModals';

type Tab = 'restock' | 'reports' | 'suppliers';
type PoFilter = 'open' | 'all';
type StatusFilter = 'open' | 'all' | DefectStatus;

const STATUS_STYLE: Record<DefectStatus, string> = {
  Reported: 'bg-coral/20 text-coral-dark',
  'Returned to supplier': 'bg-butter text-forest',
  Replaced: 'bg-mint text-forest',
  Credited: 'bg-forest text-white select-arrow-light',
};
const isOpen = (d: DefectReport) => d.status === 'Reported' || d.status === 'Returned to supplier';

const rateOf = (s: Supplier) => (s.units_sold ? (s.defective_units / s.units_sold) * 100 : null);

const EMPTY_SUPPLIER: SupplierInput = { supplier_name: '', contact_person: '', phone: '', email: '', address: '', is_active: true };

interface SupplierModalProps {
  supplier: Supplier | null;
  suppliers: Supplier[];
  categories: CategorySupplier[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// add or edit a supplier, and tick the categories it supplies (a category has one supplier, so ticking it moves it here)
function SupplierModal({ supplier, suppliers, categories, open, onClose, onSaved }: SupplierModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<SupplierInput>(EMPTY_SUPPLIER);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mailError, setMailError] = useState<string | null>(null);

  const mine = new Set(categories.filter((c) => supplier && c.supplier_id === supplier.supplier_id).map((c) => c.item_categ_id));
  const nameOf = (id: number | null) => suppliers.find((s) => s.supplier_id === id)?.supplier_name;

  useEffect(() => {
    if (!open) return;
    setError('');
    setMailError(null);
    setPicked(new Set(categories.filter((c) => supplier && c.supplier_id === supplier.supplier_id).map((c) => c.item_categ_id)));
    setForm(
      supplier
        ? {
            supplier_name: supplier.supplier_name,
            contact_person: supplier.contact_person ?? '',
            phone: supplier.phone ?? '',
            email: supplier.email ?? '',
            address: supplier.address ?? '',
            is_active: supplier.is_active,
          }
        : EMPTY_SUPPLIER,
    );
  }, [open, supplier]); // categories only matter at the moment the modal opens

  const set = (key: keyof SupplierInput) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggle = (id: number) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    if (!form.supplier_name.trim()) return setError('Please enter the supplier name');
    const badMail = form.email?.trim() ? emailError(form.email) : null;
    setMailError(badMail);
    if (badMail) return;
    const added = [...picked].filter((id) => !mine.has(id));
    if (added.length && !form.is_active) return toast.error('An inactive supplier can’t take categories. Set it active first');
    setBusy(true);
    try {
      const saved = supplier ? await defectService.editSupplier(supplier.supplier_id, form) : await defectService.addSupplier(form);
      // categories ticked now go to this supplier, unticked ones are left with no supplier
      for (const id of added) await defectService.setCategorySupplier(id, saved.supplier_id);
      for (const id of mine) if (!picked.has(id)) await defectService.setCategorySupplier(id, null);
      toast.success(supplier ? 'Supplier saved' : 'Supplier added');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the supplier');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={supplier ? `Edit ${supplier.supplier_name}` : 'Add supplier'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Supplier name" value={form.supplier_name} onChange={set('supplier_name')} error={error} maxLength={120} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Contact person (optional)" value={form.contact_person ?? ''} onChange={set('contact_person')} maxLength={120} />
          <Input label="Phone (optional)" type="tel" value={form.phone ?? ''} onChange={set('phone')} maxLength={40} />
        </div>
        <Input label="Email (optional)" type="email" maxLength={100} value={form.email ?? ''} onChange={set('email')} error={mailError} />
        <Textarea label="Address (optional)" rows={2} value={form.address ?? ''} onChange={set('address')} maxLength={300} />

        <fieldset>
          <legend className="text-sm font-medium text-ink">Categories this supplier supplies</legend>
          <p className="mt-0.5 text-xs text-muted">Every product in a ticked category comes from this supplier. A category can only have one.</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {categories.map((c) => {
              const other = c.supplier_id && !mine.has(c.item_categ_id) ? nameOf(c.supplier_id) : null;
              return (
                <li key={c.item_categ_id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-forest has-[:checked]:bg-mint-light">
                    <input type="checkbox" className="mt-0.5 size-4 accent-forest" checked={picked.has(c.item_categ_id)} onChange={() => toggle(c.item_categ_id)} />
                    <span>
                      {c.item_category} <span className="text-xs text-muted">({c.product_count})</span>
                      {other && picked.has(c.item_categ_id) && <span className="block text-xs text-amber">Moves here from {other}</span>}
                      {other && !picked.has(c.item_categ_id) && <span className="block text-xs text-muted">{other}</span>}
                      {!c.supplier_id && !picked.has(c.item_categ_id) && <span className="block text-xs text-coral-dark">No supplier yet</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        {supplier && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-forest" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            Active supplier (inactive ones can't be picked for a category)
          </label>
        )}
      </div>
    </Modal>
  );
}

function DefectDetails({ report, onClose, onSaved }: { report: DefectReport | null; onClose: () => void; onSaved: (d: DefectReport) => void }) {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setNotes(report?.notes ?? ''), [report]);
  if (!report) return null;

  const saveNotes = async () => {
    setBusy(true);
    try {
      onSaved(await defectService.update(report.defect_id, { status: report.status, notes }));
      toast.success('Notes saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the notes');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Item issue #ISS-${report.defect_id}`} size="lg">
      <div className="space-y-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-muted">Item</dt>
          <dd>
            {report.item_name} <span className="text-muted">({report.sku})</span>
          </dd>
          <dt className="text-muted">Quantity</dt>
          <dd>{report.quantity}</dd>
          <dt className="text-muted">Issue</dt>
          <dd>{report.defect_type}</dd>
          <dt className="text-muted">Supplier</dt>
          <dd>{report.supplier_name ?? <span className="text-coral-dark">No supplier set</span>}</dd>
          <dt className="text-muted">Found</dt>
          <dd>
            {SOURCE_LABEL[report.source]}
            {report.order_num && ` · order #${report.order_num}`}
          </dd>
          <dt className="text-muted">Status</dt>
          <dd>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[report.status])}>{report.status}</span>
            <span className="text-muted"> · updated {formatDateTime(report.updated_at)}</span>
          </dd>
          <dt className="text-muted">Reported</dt>
          <dd>
            {formatDateTime(report.created_at)}
            {report.reported_by_name && ` by ${report.reported_by_name}`}
          </dd>
        </dl>
        {parseImages(report.photos).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {parseImages(report.photos).map((src, i) => (
              <a key={src} href={src} target="_blank" rel="noreferrer" aria-label={`Open photo ${i + 1}`}>
                <img src={src} alt="" className="size-24 rounded-lg border border-line object-cover" />
              </a>
            ))}
          </div>
        )}
        <Textarea label="Notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. supplier pickup date, credit memo number" />
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={saveNotes} loading={busy} disabled={notes === (report.notes ?? '')}>
            Save notes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Suppliers page: the supplier of each category, and items with issues (damaged, missing parts...) to send back to them
export default function DefectsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('suppliers');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [q, setQ] = useState('');
  const [reporting, setReporting] = useState(false);
  const [fromOrder, setFromOrder] = useState<DefectOrder | null>(null);
  const [viewing, setViewing] = useState<DefectReport | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierModal, setSupplierModal] = useState(false);
  const [poFilter, setPoFilter] = useState<PoFilter>('open');
  const [poModal, setPoModal] = useState(false);
  const [viewingPo, setViewingPo] = useState<PurchaseOrder | null>(null);

  const defects = useAsync(() => defectService.getDefects(), []);
  const supplierData = useAsync(() => defectService.getSuppliers(), []);
  const purchases = useAsync(() => defectService.getPurchaseOrders(), []);
  const products = useAsync(() => productService.getAll({ includeUnavailable: true }), []);

  // opened from "Report issue to supplier" on a refund (Orders page): start the form with that order
  const orderParam = params.get('order');
  useEffect(() => {
    if (!orderParam) return;
    defectService
      .fromOrder(Number(orderParam))
      .then((o) => {
        setFromOrder(o);
        setReporting(true);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not load the order'))
      .finally(() => setParams({}, { replace: true }));
  }, [orderParam]);

  const suppliers = supplierData.data?.suppliers ?? [];
  const categories = supplierData.data?.categories ?? [];
  const all = defects.data ?? [];

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter(
      (d) =>
        (statusFilter === 'all' || (statusFilter === 'open' ? isOpen(d) : d.status === statusFilter)) &&
        (!supplierFilter || String(d.supplier_id ?? 'none') === supplierFilter) &&
        (!term || [d.item_name, d.sku, d.defect_type, d.supplier_name ?? '', `def-${d.defect_id}`].some((t) => t.toLowerCase().includes(term))),
    );
  }, [all, statusFilter, supplierFilter, q]);

  const openCount = all.filter(isOpen).length;
  const noSupplier = categories.filter((c) => !c.supplier_id).length;
  const flagged = suppliers.filter((s) => (rateOf(s) ?? 0) >= HIGH_DEFECT_RATE).length;

  const pos = purchases.data ?? [];
  const openPos = pos.filter(isPurchaseOpen);
  const unitsComing = openPos.reduce((n, po) => n + unitsLeft(po), 0);
  const poRows = poFilter === 'open' ? openPos : pos;

  // a restock order changed (received or cancelled): refresh the row, and stock / issues / supplier counts it touched
  const replacePo = (po: PurchaseOrder) => {
    purchases.setData(pos.map((x) => (x.po_id === po.po_id ? po : x)));
    if (viewingPo?.po_id === po.po_id) setViewingPo(po);
    defects.reload();
    supplierData.reload();
    products.reload();
  };

  const replaceDefect = (d: DefectReport) => {
    defects.setData(all.map((x) => (x.defect_id === d.defect_id ? d : x)));
    supplierData.reload(); // counts per supplier change
    if (viewing?.defect_id === d.defect_id) setViewing(d);
  };

  const changeStatus = async (d: DefectReport, status: DefectStatus) => {
    try {
      replaceDefect(await defectService.update(d.defect_id, { status }));
      toast.success(status === 'Replaced' ? `Replaced: ${d.quantity} added back to stock` : `#ISS-${d.defect_id} is now ${status}`);
      if (status === 'Replaced') products.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the report');
    }
  };

  const defectColumns: Column<DefectReport>[] = [
    { key: 'id', header: 'ID', render: (d) => <span className="whitespace-nowrap font-medium">#ISS-{d.defect_id}</span> },
    { key: 'date', header: 'Reported', render: (d) => <span className="whitespace-nowrap">{formatDate(d.created_at)}</span> },
    {
      key: 'item',
      header: 'Item',
      className: 'min-w-48',
      render: (d) => (
        <span>
          <span className="font-medium">{d.item_name}</span>
          <span className="block text-xs text-muted">
            {d.sku} · {d.defect_type}
          </span>
        </span>
      ),
    },
    { key: 'qty', header: 'Qty', render: (d) => d.quantity },
    { key: 'supplier', header: 'Supplier', render: (d) => d.supplier_name ?? <span className="text-coral-dark">None set</span> },
    {
      key: 'source',
      header: 'Found',
      render: (d) => (
        <span className="text-xs">
          {SOURCE_LABEL[d.source]}
          {d.order_num && <span className="block text-muted">Order #{d.order_num}</span>}
          {d.po_id && <span className="block text-muted">Restock #PO-{d.po_id}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (d) => {
        const next = DEFECT_NEXT[d.status];
        return (
          <select
            aria-label={`Status of issue ${d.defect_id}`}
            value={d.status}
            disabled={!next.length}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => changeStatus(d, e.target.value as DefectStatus)}
            className={cn('cursor-pointer rounded-full border-0 py-1 pl-3 pr-7 text-xs font-semibold disabled:cursor-default', STATUS_STYLE[d.status])}
          >
            {[d.status, ...next].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'view',
      header: '',
      render: (d) => (
        <button onClick={() => setViewing(d)} className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-forest hover:underline">
          {parseImages(d.photos).length > 0 && <Images className="size-3.5" />} View
        </button>
      ),
    },
  ];

  const supplierColumns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier',
      className: 'min-w-44',
      render: (s) => (
        <span>
          <span className="font-medium">{s.supplier_name}</span>
          {!s.is_active && <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold text-muted">Inactive</span>}
          <span className="block text-xs text-muted">{[s.contact_person, s.phone, s.email].filter(Boolean).join(' · ') || 'No contact details'}</span>
        </span>
      ),
    },
    { key: 'categories', header: 'Categories', render: (s) => (s.categories.length ? s.categories.join(', ') : <span className="text-muted">–</span>) },
    { key: 'sold', header: 'Units sold', render: (s) => s.units_sold },
    { key: 'defective', header: 'Units with issues', render: (s) => s.defective_units },
    {
      key: 'rate',
      header: 'Issue rate',
      render: (s) => {
        const rate = rateOf(s);
        if (rate === null) return <span className="text-muted">–</span>;
        const high = rate >= HIGH_DEFECT_RATE;
        return (
          <span className={cn('inline-flex items-center gap-1 font-semibold', high ? 'text-coral-dark' : 'text-forest')}>
            {high && <AlertTriangle className="size-3.5" />}
            {rate.toFixed(1)}%
          </span>
        );
      },
    },
    { key: 'open', header: 'Open reports', render: (s) => s.open_count },
    {
      key: 'edit',
      header: '',
      render: (s) => (
        <button
          onClick={() => {
            setEditingSupplier(s);
            setSupplierModal(true);
          }}
          className="inline-flex items-center gap-1 text-sm text-forest hover:underline"
          aria-label={`Edit ${s.supplier_name}`}
        >
          <Pencil className="size-3.5" /> Edit
        </button>
      ),
    },
  ];

  const poColumns: Column<PurchaseOrder>[] = [
    { key: 'id', header: 'Order', render: (po) => <span className="whitespace-nowrap font-medium">#PO-{po.po_id}</span> },
    { key: 'date', header: 'Ordered', render: (po) => <span className="whitespace-nowrap">{formatDate(po.created_at)}</span> },
    { key: 'supplier', header: 'Supplier', className: 'min-w-40', render: (po) => po.supplier_name },
    {
      key: 'items',
      header: 'Items',
      className: 'min-w-48',
      render: (po) => (
        <span className="text-xs">
          {po.items
            .slice(0, 2)
            .map((i) => `${i.quantity} × ${i.item_name}`)
            .join(', ')}
          {po.items.length > 2 && <span className="text-muted"> +{po.items.length - 2} more</span>}
        </span>
      ),
    },
    {
      key: 'progress',
      header: 'Arrived',
      render: (po) => {
        const ordered = po.items.reduce((n, i) => n + i.quantity, 0);
        const left = unitsLeft(po);
        return (
          <span className="whitespace-nowrap">
            {ordered - left} / {ordered}
            {po.status === 'Cancelled' && left > 0 && <span className="block text-xs text-muted">{left} cancelled</span>}
          </span>
        );
      },
    },
    {
      key: 'total',
      header: 'Total',
      render: (po) => {
        const total = purchaseTotal(po);
        return total === null ? <span className="text-muted">–</span> : <span className="whitespace-nowrap">{formatPeso(total)}</span>;
      },
    },
    { key: 'expected', header: 'Expected', render: (po) => (po.expected_date ? <span className="whitespace-nowrap">{formatDate(po.expected_date)}</span> : <span className="text-muted">–</span>) },
    { key: 'status', header: 'Status', render: (po) => <PoStatus status={po.status} /> },
    {
      key: 'view',
      header: '',
      render: (po) => (
        <button onClick={() => setViewingPo(po)} className="whitespace-nowrap text-sm text-forest hover:underline">
          {isPurchaseOpen(po) ? 'Receive' : 'View'}
        </button>
      ),
    },
  ];

  const loading = (defects.loading && !defects.data) || (supplierData.loading && !supplierData.data) || (purchases.loading && !purchases.data);
  const error = defects.error || supplierData.error || purchases.error;

  return (
    <div>
      <AdminPageHeader
        title="Suppliers"
        subtitle="Order stock from your suppliers, receive it into inventory, and send back items with issues."
        actions={
          <>
            <NewRestockButton onClick={() => setPoModal(true)} disabled={!products.data || !suppliers.length} />
            <Button
              onClick={() => {
                setFromOrder(null);
                setReporting(true);
              }}
              disabled={!products.data}
            >
              <PackageX className="size-4" /> Report item issue
            </Button>
          </>
        }
      />

      {loading ? (
        <LoadingState label="Loading..." layout="list" />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            defects.reload();
            supplierData.reload();
            purchases.reload();
          }}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatCard label="Restock orders on the way" value={openPos.length} icon={<ClipboardList className="size-4" />} tone={openPos.length ? 'amber' : 'forest'} />
            <StatCard label="Units still to arrive" value={unitsComing} icon={<Truck className="size-4" />} />
            <StatCard label="Open item issues" value={openCount} icon={<PackageX className="size-4" />} tone={openCount ? 'coral' : 'forest'} />
            <StatCard label={`Suppliers over ${HIGH_DEFECT_RATE}% issues`} value={flagged} icon={<AlertTriangle className="size-4" />} tone={flagged ? 'coral' : 'forest'} />
          </div>

          <FilterPills
            value={tab}
            onChange={setTab}
            options={[
              { value: 'suppliers', label: `Suppliers (${suppliers.length})` },
              { value: 'restock', label: `Restock orders (${openPos.length} open)` },
              { value: 'reports', label: `Item issues (${openCount} open)` },
            ]}
          />

          {tab === 'restock' && (
            <Card
              title="Restock orders"
              actions={
                <div className="flex flex-wrap items-center gap-3">
                  <FilterPills
                    value={poFilter}
                    onChange={setPoFilter}
                    options={[
                      { value: 'open', label: `On the way (${openPos.length})` },
                      { value: 'all', label: `All (${pos.length})` },
                    ]}
                  />
                  <NewRestockButton size="sm" onClick={() => setPoModal(true)} disabled={!products.data || !suppliers.length} />
                </div>
              }
            >
              {poRows.length === 0 ? (
                <EmptyState
                  title={pos.length ? 'Nothing on the way' : 'No restock orders yet'}
                  message={pos.length ? 'Every restock order has been received or cancelled.' : 'Use "New restock order" to order stock from a supplier. When it arrives, receive it here and it goes into inventory.'}
                />
              ) : (
                <>
                  <Table columns={poColumns} rows={poRows} rowKey={(po) => po.po_id} />
                  <p className="mt-3 text-xs text-muted">Open Receive when a delivery arrives: good units are added to stock, damaged ones become item issues for the supplier.</p>
                </>
              )}
            </Card>
          )}

          {/* reports only point to a supplier once its category has one */}
          {noSupplier > 0 && tab === 'reports' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber/40 bg-butter-light px-4 py-3 text-sm">
              <span className="flex items-start gap-2 text-ink">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
                <span>
                  <span className="font-semibold">
                    {noSupplier} of {categories.length} categories have no supplier yet.
                  </span>{' '}
                  Item issues in those categories won't be linked to a supplier.
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => setTab('suppliers')}>
                <Truck className="size-4" /> Set up suppliers
              </Button>
            </div>
          )}

          {tab === 'reports' && (
            <Card>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <FilterPills
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'open', label: `Open (${openCount})` },
                    { value: 'Reported', label: 'Reported' },
                    { value: 'Returned to supplier', label: 'Returned' },
                    { value: 'Replaced', label: 'Replaced' },
                    { value: 'Credited', label: 'Credited' },
                    { value: 'all', label: 'All' },
                  ]}
                />
                <div className="flex flex-1 flex-wrap justify-end gap-3">
                  <div className="w-44">
                    <Select aria-label="Filter by supplier" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="h-10 !py-0">
                      <option value="">All suppliers</option>
                      {suppliers.map((s) => (
                        <option key={s.supplier_id} value={s.supplier_id}>
                          {s.supplier_name}
                        </option>
                      ))}
                      <option value="none">No supplier set</option>
                    </Select>
                  </div>
                  <SearchBox value={q} onChange={setQ} placeholder="Search item, SKU or issue" className="w-full sm:w-64" />
                </div>
              </div>
              {rows.length === 0 ? (
                <EmptyState
                  title={all.length ? 'No item issues here' : 'No item issues yet'}
                  message={all.length ? 'Try another filter.' : 'Use "Report item issue" when an item arrives damaged, is found damaged in stock, or a customer returns one.'}
                />
              ) : (
                <Table columns={defectColumns} rows={rows} rowKey={(d) => d.defect_id} />
              )}
            </Card>
          )}

          {tab === 'suppliers' && (
            <>
              {noSupplier > 0 && (
                <div className="flex items-start gap-2 rounded-card border border-amber/40 bg-butter-light px-4 py-3 text-sm text-ink">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
                  <span>
                    <span className="font-semibold">No supplier yet for {categories.filter((c) => !c.supplier_id).map((c) => c.item_category).join(', ')}.</span>{' '}
                    Open a supplier with Edit and tick the categories it supplies.
                  </span>
                </div>
              )}

              <Card
                title="Suppliers"
                actions={
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingSupplier(null);
                      setSupplierModal(true);
                    }}
                  >
                    <Plus className="size-4" /> Add supplier
                  </Button>
                }
              >
                {suppliers.length === 0 ? (
                  <EmptyState title="No suppliers yet" message="Add a supplier and tick the categories it supplies." />
                ) : (
                  <>
                    <Table columns={supplierColumns} rows={suppliers} rowKey={(s) => s.supplier_id} />
                    <p className="mt-3 text-xs text-muted">
                      Issue rate = units with issues ÷ units sold from the supplier's categories. {HIGH_DEFECT_RATE}% or more is flagged.
                    </p>
                  </>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      <DefectFormModal
        open={reporting}
        onClose={() => setReporting(false)}
        onSaved={(d) => {
          setReporting(false);
          setTab('reports');
          defects.setData([d, ...all]);
          supplierData.reload();
          if (d.source === 'storage') products.reload();
        }}
        products={products.data ?? []}
        suppliers={suppliers}
        categories={categories}
        order={fromOrder}
      />
      <SupplierModal
        open={supplierModal}
        supplier={editingSupplier}
        suppliers={suppliers}
        categories={categories}
        onClose={() => setSupplierModal(false)}
        onSaved={() => {
          setSupplierModal(false);
          supplierData.reload();
        }}
      />
      <DefectDetails report={viewing} onClose={() => setViewing(null)} onSaved={replaceDefect} />
      <PurchaseOrderModal
        open={poModal}
        onClose={() => setPoModal(false)}
        onSaved={(po) => {
          setPoModal(false);
          setTab('restock');
          purchases.setData([po, ...pos]);
          supplierData.reload();
        }}
        products={products.data ?? []}
        suppliers={suppliers}
        categories={categories}
      />
      <PurchaseOrderDetails po={viewingPo} onClose={() => setViewingPo(null)} onChanged={replacePo} />
    </div>
  );
}
