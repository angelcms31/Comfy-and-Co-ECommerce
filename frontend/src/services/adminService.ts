import { http } from '@/lib/http';
import type {
  AdminAccount,
  AdminRoleName,
  AllSettings,
  AuditAction,
  AuditLogRow,
  NewAdminInput,
  PolicySettings,
  RegionalSettings,
  SecuritySettings,
  StoreSettings,
} from '@/types/admin';

// Settings page. Everything except getSettings is Super Admin only (the backend checks).
export const adminService = {
  getAdmins: () => http<AdminAccount[]>('/admin/admins'),
  addAdmin: (input: NewAdminInput) => http<AdminAccount>('/admin/admins', { method: 'POST', body: input }),
  changeRole: (userId: string, role: AdminRoleName) => http<AdminAccount>(`/admin/admins/${userId}/role`, { method: 'PATCH', body: { role } }),
  resetPassword: (userId: string, password: string) => http<void>(`/admin/admins/${userId}/password`, { method: 'POST', body: { password } }),
  deactivate: (userId: string) => http<AdminAccount>(`/admin/admins/${userId}/deactivate`, { method: 'POST' }),
  reactivate: (userId: string) => http<AdminAccount>(`/admin/admins/${userId}/reactivate`, { method: 'POST' }),

  getSettings: () => http<AllSettings>('/admin/settings'),
  saveStore: (s: StoreSettings) => http<StoreSettings>('/admin/settings/store', { method: 'PUT', body: s }),
  savePolicies: (s: PolicySettings) => http<PolicySettings>('/admin/settings/policies', { method: 'PUT', body: s }),
  saveRegional: (s: RegionalSettings) => http<RegionalSettings>('/admin/settings/regional', { method: 'PUT', body: s }),
  saveSecurity: (s: Pick<SecuritySettings, 'require_2fa' | 'inactivity_minutes'>) =>
    http<SecuritySettings>('/admin/settings/security', { method: 'PUT', body: s }),
  forceLogout: () => http<SecuritySettings>('/admin/settings/force-logout', { method: 'POST' }),

  getAuditLogs: (q: { admin?: string; action?: AuditAction; page?: number; pageSize?: number } = {}) =>
    http<{ total: number; rows: AuditLogRow[] }>('/admin/audit-logs', {
      params: { admin: q.admin, action: q.action, page: q.page, page_size: q.pageSize },
    }),
};

// public store contact details, used by Contact Us and the footer
export const storeInfoService = {
  get: () => http<StoreSettings>('/store-info'),
};
