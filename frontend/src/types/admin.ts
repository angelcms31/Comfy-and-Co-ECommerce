// Shapes of the admin panel endpoints (backend/app/routers/admin.py, admins.py, settings.py)
import type { UserRoleName } from './db';
import type { OrderWithItems } from './models';

// 7d: days + 1 day forecast, 30d: weeks + 1 week, 12m: months + 6 months, 24m (long term): months + 12 months
export type SalesRange = '7d' | '30d' | '12m' | '24m';

export interface DashboardSummary {
  salesToday: number;
  ordersToday: number;
  lowStockCount: number;
  avgRating: number;
  reviewCount: number;
  // actual bars, then the forecast bars (straight-line trend of the actual bars).
  // monthly ranges: the current month is `partial` (month to date) and `expected` is the trend's figure for it
  chart: { label: string; total: number; forecast: boolean; partial?: boolean; expected?: number }[];
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

export type AuditAction = 'products' | 'orders' | 'reviews' | 'admins' | 'settings' | 'inventory';

export interface AuditLogRow {
  log_id: number;
  created_at: string;
  action: string;
  ip_address: string | null;
  device: string | null;
  admin_name: string | null;
  role: UserRoleName | null;
}
