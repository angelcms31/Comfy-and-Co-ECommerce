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
  // top 5 products by how many customers saved them to their Likes
  mostLiked: { product_id: number; product_name: string; likes: number; images: string | null }[];
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

// one row of the Lalamove rate card (backend LALAMOVE_VEHICLES): cargo size, weight limit and the fare
export interface DeliveryVehicle {
  name: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  max_kg: number;
  base: number;
  per_km: number;
  tier_km: number | null; // the per_km rate applies up to here, per_km_after beyond it
  per_km_after: number | null;
  included_km: number; // km already covered by the base fare
}

export interface DeliverySettings {
  store_lat: number;
  store_lng: number;
  max_km: number; // 0 = deliver anywhere
  vehicles: DeliveryVehicle[];
}

export interface AllSettings {
  store: StoreSettings;
  policies: PolicySettings;
  regional: RegionalSettings;
  security: SecuritySettings;
  delivery: DeliverySettings;
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
