// Shapes of the admin panel endpoints (backend/app/routers/admin.py, admins.py, settings.py)
import type { UserRoleName } from './db';
import type { OrderWithItems } from './models';

export type SalesRange = '7d' | '30d';

export interface DashboardSummary {
  salesToday: number;
  ordersToday: number;
  lowStockCount: number;
  avgRating: number;
  reviewCount: number;
  // the last bar is the forecast (straight-line trend of the actual bars)
  chart: { label: string; total: number; forecast: boolean }[];
  recentOrders: OrderWithItems[];
}

export type AdminRoleName = Exclude<UserRoleName, 'customer'>;

export interface AdminAccount {
  user_id: string;
  full_name: string;
  email: string;
  role: AdminRoleName;
  deactivated_at: string | null;
  date_added: string;
  last_active?: string | null;
}

export interface NewAdminInput {
  full_name: string;
  email: string;
  password: string;
  role: AdminRoleName;
}

export interface StoreSettings {
  name: string;
  support_email: string;
  phone: string;
  address: string;
  hours: string;
}

export interface PolicySettings {
  cancellation_window: string;
  return_policy: string;
  refund_method: string;
  free_shipping_threshold: number;
}

export interface RegionalSettings {
  currency: string;
  vat_percent: number;
  timezone: string;
}

export interface SecuritySettings {
  require_2fa: boolean;
  inactivity_minutes: number;
  sessions_valid_after: string | null;
}

export interface AllSettings {
  store: StoreSettings;
  policies: PolicySettings;
  regional: RegionalSettings;
  security: SecuritySettings;
}

export type AuditAction = 'products' | 'orders' | 'reviews' | 'admins' | 'settings';

export interface AuditLogRow {
  log_id: number;
  created_at: string;
  action: string;
  ip_address: string | null;
  device: string | null;
  admin_name: string | null;
  role: UserRoleName | null;
}
