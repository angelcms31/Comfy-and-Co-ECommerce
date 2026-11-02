import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Plus, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input, { Select } from '@/components/ui/Input';
import { LogoMark } from '@/components/layout/Logo';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import PasswordInput from '@/components/ui/PasswordInput';
import Table, { type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { adminService } from '@/services/adminService';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime } from '@/lib/dates';
import { ROLE_LABEL } from '@/lib/roles';
import type { AdminAccount, AdminRoleName, AllSettings, AuditAction, AuditLogRow, NewAdminInput } from '@/types/admin';
import AdminPageHeader from './AdminPageHeader';
import { Card, FilterPills } from './AdminUi';

type Tab = 'users' | 'store' | 'security';

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');

function timeAgo(iso: string | null | undefined) {
  if (!iso) return 'Never';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

const initials = (name: string | null) =>
  (name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

function RoleBadge({ role }: { role: AdminRoleName | null }) {
  if (!role) return null;
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', role === 'super_admin' ? 'bg-forest text-white' : 'bg-mint-light text-forest')}>
      {ROLE_LABEL[role]}
    </span>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-3 text-sm', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-forest' : 'bg-line')}
      >
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
      <span>{label}</span>
    </label>
  );
}

// ---------- shared security controls (User Management and Security tabs) ----------

function useSecurityActions(settings: ReturnType<typeof useAsync<AllSettings>>) {
  const toast = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const saveSecurity = async (changes: Partial<{ require_2fa: boolean; inactivity_minutes: number }>) => {
    if (!settings.data) return;
    setBusy(true);
    try {
      const { require_2fa, inactivity_minutes } = settings.data.security;
      await adminService.saveSecurity({ require_2fa, inactivity_minutes, ...changes });
      toast.success('Security policy saved');
      settings.reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const forceLogout = async () => {
    setBusy(true);
    try {
      await adminService.forceLogout();
      // this logs out the Super Admin who pressed it too
      await logout();
      navigate('/admin/login', { replace: true, state: { notice: 'All admin sessions were logged out. Please log in again.' } });
    } catch (err) {
      toast.error(errorText(err));
      setBusy(false);
    }
  };

  const dialog = (
    <ConfirmDialog
      open={confirmLogout}
      title="Force logout all sessions?"
      danger
      loading={busy}
      confirmLabel="Log everyone out"
      onCancel={() => setConfirmLogout(false)}
      onConfirm={forceLogout}
      message="Every admin, including you, will be logged out right away and has to log in again."
    />
  );
  return { busy, saveSecurity, askForceLogout: () => setConfirmLogout(true), dialog };
}

// ---------- User Management ----------

function AddAdminModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const empty: NewAdminInput = { full_name: '', email: '', password: '', role: 'admin' };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminService.addAdmin({ ...form, full_name: form.full_name.trim(), email: form.email.trim() });
      toast.success(`${form.full_name.trim()} can now log in at /admin/login`);
      onAdded();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Add New Admin"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-admin" loading={busy}>
            Create account
          </Button>
        </>
      }
    >
      <form id="add-admin" onSubmit={onSubmit} className="space-y-3">
        <Input label="Full name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <PasswordInput
          label="Temporary password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <p className="-mt-2 text-xs text-muted">At least 8 characters. Share it with them privately.</p>
        <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRoleName })}>
          <option value="admin">Admin (daily operations)</option>
          <option value="super_admin">Super Admin (full access)</option>
        </Select>
      </form>
    </Modal>
  );
}

function UserManagement({ settings, addOpen, setAddOpen }: { settings: ReturnType<typeof useAsync<AllSettings>>; addOpen: boolean; setAddOpen: (v: boolean) => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const admins = useAsync(() => adminService.getAdmins(), []);
  const activity = useAsync(() => adminService.getAuditLogs({ pageSize: 3 }), []);
  const security = useSecurityActions(settings);
  const [filter, setFilter] = useState<'all' | 'active' | 'deactivated'>('all');
  const [editingRole, setEditingRole] = useState<AdminAccount | null>(null);
  const [newRole, setNewRole] = useState<AdminRoleName>('admin');
  const [resetting, setResetting] = useState<AdminAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deactivating, setDeactivating] = useState<AdminAccount | null>(null);
  const [busy, setBusy] = useState(false);

  const list = admins.data ?? [];
  const active = list.filter((a) => !a.deactivated_at);
  const inactive = list.filter((a) => a.deactivated_at);
  const rows = filter === 'active' ? active : filter === 'deactivated' ? inactive : list;

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      setEditingRole(null);
      setResetting(null);
      setDeactivating(null);
      admins.reload();
      activity.reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const link = 'font-medium hover:underline';
  const columns: Column<AdminAccount>[] = [
    {
      key: 'name',
      header: 'User Name',
      render: (a) => (
        <span className="flex items-center gap-2 font-medium text-ink">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cream text-xs text-muted">{initials(a.full_name)}</span>
          {a.full_name}
        </span>
      ),
    },
    { key: 'email', header: 'Email', render: (a) => <span className="text-muted">{a.email}</span> },
    { key: 'role', header: 'Role', render: (a) => <RoleBadge role={a.role} /> },
    {
      key: 'status',
      header: 'Status',
      render: (a) =>
        a.deactivated_at ? (
          <span className="text-xs text-muted">○ Deactivated</span>
        ) : (
          <span className="text-xs font-medium text-forest-light">● Active</span>
        ),
    },
    {
      key: 'when',
      header: filter === 'deactivated' ? 'Deactivated On' : 'Last Active',
      render: (a) => <span className="text-muted">{a.deactivated_at ? formatDate(a.deactivated_at) : timeAgo(a.last_active)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (a) => {
        if (a.user_id === user?.user_id) return <span className="text-xs text-muted">You</span>;
        if (a.role === 'super_admin') return <span className="text-xs text-muted">System Guarded</span>;
        if (a.deactivated_at)
          return (
            <button onClick={() => run(() => adminService.reactivate(a.user_id), `${a.full_name} can log in again`)} className={cn(link, 'flex items-center gap-1 text-forest-light')}>
              <RotateCcw className="size-3.5" /> Reactivate Account
            </button>
          );
        return (
          <span className="flex flex-wrap gap-3 text-sm">
            <button
              onClick={() => {
                setNewRole(a.role);
                setEditingRole(a);
              }}
              className={cn(link, 'text-ink')}
            >
              Edit Role
            </button>
            <button
              onClick={() => {
                setNewPassword('');
                setResetting(a);
              }}
              className={cn(link, 'text-ink')}
            >
              Reset Pass
            </button>
            <button onClick={() => setDeactivating(a)} className={cn(link, 'text-coral-dark')}>
              Deactivate
            </button>
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-forest">Admin Team Members &amp; Permissions</h2>
            <p className="text-xs text-muted">Super Admins have full access; regular Admins manage daily operations.</p>
          </div>
          <FilterPills
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All (${list.length})` },
              { value: 'active', label: `Active (${active.length})`, activeClass: 'border-forest-light bg-forest-light text-white' },
              { value: 'deactivated', label: `Deactivated (${inactive.length})`, activeClass: 'border-coral-dark bg-coral-dark text-white' },
            ]}
          />
        </div>
        {admins.loading && <LoadingState layout="table" />}
        {admins.error && <ErrorState message={admins.error} onRetry={admins.reload} />}
        {admins.data && (rows.length ? <Table columns={columns} rows={rows} rowKey={(a) => a.user_id} /> : <EmptyState title="No accounts here" />)}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={<span className="text-lg">System Security</span>}>
          <Toggle
            checked={!!settings.data?.security.require_2fa}
            disabled={!settings.data || security.busy}
            onChange={(v) => security.saveSecurity({ require_2fa: v })}
            label={`Require Two-Factor Authentication (2FA) for All Admins (${settings.data?.security.require_2fa ? 'Enabled' : 'Disabled'})`}
          />
          <Button variant="secondary" className="mt-4 w-full" onClick={security.askForceLogout}>
            Force Logout All Active Sessions
          </Button>
        </Card>
        <Card title={<span className="text-lg">Recent System Activity</span>}>
          {activity.data?.rows.length ? (
            <ul className="space-y-2 text-sm">
              {activity.data.rows.map((r) => (
                <li key={r.log_id} className="flex gap-2">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-forest-light" />
                  <span>
                    <span className="font-medium">{r.admin_name ?? 'Removed user'}</span> {r.action.charAt(0).toLowerCase() + r.action.slice(1)}{' '}
                    <span className="text-muted">({timeAgo(r.created_at)})</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{activity.loading ? 'Loading...' : 'No activity yet.'}</p>
          )}
        </Card>
      </div>

      <AddAdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false);
          admins.reload();
          activity.reload();
        }}
      />

      <Modal
        open={!!editingRole}
        onClose={() => !busy && setEditingRole(null)}
        title={`Edit role of ${editingRole?.full_name ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingRole(null)} disabled={busy}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => editingRole && run(() => adminService.changeRole(editingRole.user_id, newRole), 'Role updated')}>
              Save role
            </Button>
          </>
        }
      >
        <Select label="Role" value={newRole} onChange={(e) => setNewRole(e.target.value as AdminRoleName)}>
          <option value="admin">Admin (daily operations)</option>
          <option value="super_admin">Super Admin (full access)</option>
        </Select>
      </Modal>

      <Modal
        open={!!resetting}
        onClose={() => !busy && setResetting(null)}
        title={`Reset password of ${resetting?.full_name ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={newPassword.length < 8}
              onClick={() => resetting && run(() => adminService.resetPassword(resetting.user_id, newPassword), 'Password changed. Share it with them privately.')}
            >
              Set password
            </Button>
          </>
        }
      >
        <PasswordInput label="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <p className="mt-1 text-xs text-muted">At least 8 characters. Share it with them privately.</p>
      </Modal>

      <ConfirmDialog
        open={!!deactivating}
        title="Deactivate this admin?"
        danger
        loading={busy}
        confirmLabel="Deactivate"
        onCancel={() => setDeactivating(null)}
        onConfirm={() => deactivating && run(() => adminService.deactivate(deactivating.user_id), `${deactivating.full_name} was deactivated`)}
        message={
          <>
            <strong className="text-ink">{deactivating?.full_name}</strong> will be logged out and can't log in until you reactivate the account.
          </>
        }
      />
      {security.dialog}
    </div>
  );
}

// ---------- Store Info & Currency ----------

function StoreInfo({ settings }: { settings: ReturnType<typeof useAsync<AllSettings>> }) {
  const toast = useToast();
  const [form, setForm] = useState<AllSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  if (!form) return settings.error ? <ErrorState message={settings.error} onRetry={settings.reload} /> : <LoadingState />;

  const set = <K extends keyof AllSettings>(section: K, field: keyof AllSettings[K]) => (e: { target: { value: string } }) =>
    setForm((f) => f && { ...f, [section]: { ...f[section], [field]: e.target.value } });

  const saveAll = async () => {
    setBusy(true);
    try {
      await adminService.saveStore(form.store);
      await adminService.savePolicies({ ...form.policies, free_shipping_threshold: Number(form.policies.free_shipping_threshold) || 0 });
      await adminService.saveRegional({ ...form.regional, vat_percent: Number(form.regional.vat_percent) || 0 });
      toast.success('Store settings saved');
      settings.reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={<span className="text-lg">Store Identity &amp; Branding</span>}>
          <div className="space-y-3">
            <div className="text-center">
              <p className="mb-2 text-xs font-medium text-ink">Store Logo</p>
              <span className="mx-auto grid size-20 place-items-center rounded-xl bg-cream">
                <LogoMark className="size-14" />
              </span>
              <p className="mt-1 text-[11px] text-muted">To change it, replace frontend/public/logo.png</p>
            </div>
            <Input label="Store Name" value={form.store.name} onChange={set('store', 'name')} />
            <Input label="Support Email" type="email" value={form.store.support_email} onChange={set('store', 'support_email')} />
            <Input label="Contact Number" value={form.store.phone} onChange={set('store', 'phone')} />
            <Input label="Store Address" value={form.store.address} onChange={set('store', 'address')} />
            <Input label="Store Hours" value={form.store.hours} onChange={set('store', 'hours')} />
          </div>
        </Card>

        <Card title={<span className="text-lg">Order, Cancellation &amp; Refund Policies</span>}>
          <div className="space-y-3">
            <Select label="Order Cancellation Window" value={form.policies.cancellation_window} onChange={set('policies', 'cancellation_window')}>
              <option>Before the order ships</option>
              <option>Within 24 Hours of Order Placement</option>
              <option>Within 48 Hours of Order Placement</option>
            </Select>
            <Select label="Return &amp; Refund Policy" value={form.policies.return_policy} onChange={set('policies', 'return_policy')}>
              <option>7-Day Return &amp; Refund Window</option>
              <option>14-Day Return &amp; Refund Window</option>
              <option>30-Day Return &amp; Refund Window</option>
              <option>No Returns</option>
            </Select>
            <Select label="Refund Method" value={form.policies.refund_method} onChange={set('policies', 'refund_method')}>
              <option>Original Payment Method</option>
              <option>GCash</option>
              <option>Store Credit</option>
            </Select>
            <Input
              label="Free Shipping Threshold (₱)"
              type="number"
              min={0}
              hint="0 means no free shipping"
              value={form.policies.free_shipping_threshold}
              onChange={set('policies', 'free_shipping_threshold')}
            />
          </div>
        </Card>

        <Card title={<span className="text-lg">Regional &amp; Tax Settings</span>}>
          <div className="space-y-3">
            <Select label="Base Currency" value={form.regional.currency} onChange={set('regional', 'currency')}>
              <option value="PHP">Philippine Peso - PHP ₱</option>
            </Select>
            <Input label="Value Added Tax (VAT %)" type="number" min={0} max={100} value={form.regional.vat_percent} onChange={set('regional', 'vat_percent')} />
            <Select label="System Timezone" value={form.regional.timezone} onChange={set('regional', 'timezone')}>
              <option value="Asia/Manila">(GMT+08:00) Asia/Manila</option>
            </Select>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white p-4">
        <div>
          <p className="font-medium text-ink">Store Settings</p>
          <p className="text-xs text-muted">Review all store settings before saving.</p>
        </div>
        <Button loading={busy} onClick={saveAll}>
          Save All Store Settings
        </Button>
      </div>
    </div>
  );
}

// ---------- Security & Audit Logs ----------

const ACTIONS: { value: AuditAction | ''; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'products', label: 'Products' },
  { value: 'orders', label: 'Orders' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'admins', label: 'Admin accounts' },
  { value: 'settings', label: 'Settings' },
];

function SecurityLogs({ settings }: { settings: ReturnType<typeof useAsync<AllSettings>> }) {
  const security = useSecurityActions(settings);
  const admins = useAsync(() => adminService.getAdmins(), []);
  const [admin, setAdmin] = useState('');
  const [action, setAction] = useState<AuditAction | ''>('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const logs = useAsync(() => adminService.getAuditLogs({ admin: admin || undefined, action: action || undefined, page, pageSize }), [admin, action, page]);
  useEffect(() => setPage(1), [admin, action]);

  const columns: Column<AuditLogRow>[] = [
    { key: 'time', header: 'Timestamp', render: (r) => <span className="whitespace-nowrap text-muted">{formatDateTime(r.created_at)}</span> },
    { key: 'admin', header: 'Admin User', render: (r) => <span className="font-medium">{r.admin_name ?? 'Removed user'}</span> },
    { key: 'role', header: 'Role', render: (r) => (r.role && r.role !== 'customer' ? <RoleBadge role={r.role} /> : '–') },
    { key: 'action', header: 'Action Performed', render: (r) => r.action },
    {
      key: 'ip',
      header: 'IP Address / Device',
      render: (r) => (
        <span className="whitespace-nowrap text-muted">
          {r.ip_address ?? '–'} ({r.device ?? 'Unknown'})
        </span>
      ),
    },
  ];

  const minutes = settings.data?.security.inactivity_minutes ?? 30;

  return (
    <div className="space-y-5">
      <Card title={<span className="text-lg">Global Security &amp; Authentication Policies</span>}>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Toggle
                checked={!!settings.data?.security.require_2fa}
                disabled={!settings.data || security.busy}
                onChange={(v) => security.saveSecurity({ require_2fa: v })}
                label={<span className="font-medium">Require 2FA for All Admins</span>}
              />
              <p className="ml-14 text-xs text-muted">An extra layer of protection for every admin account. Saved as a policy; sign-in codes aren't set up yet.</p>
            </div>
            <Button variant="outline" className="border-coral-dark text-coral-dark hover:bg-cancelled" onClick={security.askForceLogout}>
              <Lock className="size-4" /> Force Logout All Active Sessions
            </Button>
          </div>
          <Select
            label="Auto Logout Inactivity Timeout"
            value={minutes}
            disabled={!settings.data || security.busy}
            onChange={(e) => security.saveSecurity({ inactivity_minutes: Number(e.target.value) })}
          >
            {[15, 30, 60, 120].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} Minutes` : `${m / 60} Hour${m === 60 ? '' : 's'}`} of Inactivity (idle time)
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card
        title={<span className="text-lg">System Audit Log</span>}
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="w-48">
              <Select aria-label="Filter by admin" value={admin} onChange={(e) => setAdmin(e.target.value)} className="h-9 py-0">
                <option value="">Filter by Admin: All Admins</option>
                {admins.data?.map((a) => (
                  <option key={a.user_id} value={a.user_id}>
                    {a.full_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-48">
              <Select aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value as AuditAction | '')} className="h-9 py-0">
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    Filter by Action: {a.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        }
      >
        {logs.loading && !logs.data && <LoadingState layout="table" />}
        {logs.error && <ErrorState message={logs.error} onRetry={logs.reload} />}
        {logs.data &&
          (logs.data.rows.length ? (
            <>
              <Table columns={columns} rows={logs.data.rows} rowKey={(r) => r.log_id} />
              <div className="border-t border-line">
                <Pagination page={page} pageSize={pageSize} total={logs.data.total} onChange={setPage} />
              </div>
            </>
          ) : (
            <EmptyState title="No activity found" message="Changes admins make to products, orders, reviews and settings show up here." />
          ))}
      </Card>
      {security.dialog}
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [addOpen, setAddOpen] = useState(false);
  const settings = useAsync(() => adminService.getSettings(), []);

  return (
    <>
      <AdminPageHeader
        title="Settings & Admin Control"
        subtitle="Super Admin Panel: Manage admin accounts, roles, security, and system preferences."
        actions={
          <Button
            onClick={() => {
              setTab('users');
              setAddOpen(true);
            }}
          >
            <Plus className="size-4" /> Add New Admin
          </Button>
        }
      />
      <FilterPills
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'users', label: 'User Management' },
          { value: 'store', label: 'Store Info & Currency' },
          { value: 'security', label: 'Security & Audit Logs' },
        ]}
      />
      {tab === 'users' && <UserManagement settings={settings} addOpen={addOpen} setAddOpen={setAddOpen} />}
      {tab === 'store' && <StoreInfo settings={settings} />}
      {tab === 'security' && <SecurityLogs settings={settings} />}
    </>
  );
}
