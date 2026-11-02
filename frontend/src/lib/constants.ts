export const LOW_STOCK_LIMIT = 5;
export const DAILY_SALES_TARGET = 50000;
export const MAX_LOGIN_ATTEMPTS = 3;

export const COLLECTIONS = [
  { value: 'all', label: 'All products' },
  { value: 'best_sellers', label: 'Best sellers' },
  { value: 'limited', label: 'Limited' },
] as const;

// checkout: must match DELIVERY_FEE and COURIERS in backend/app/config.py
export const DELIVERY_FEE = 100;
export const COURIERS = ['J&T Express', 'LBC', 'Flash Express', 'Ninja Van'] as const;
export const DELIVERY_DAYS = [3, 5]; // shown as "Estimated Oct 13-15"
export const STORE_ADDRESS = 'Comfy&Co Showroom, 2F Ortigas Center, Pasig';
