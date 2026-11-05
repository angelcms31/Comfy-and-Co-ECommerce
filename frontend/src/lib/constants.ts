export const LOW_STOCK_LIMIT = 5;

// the store's GCash QR, from the GCash app, cropped to just the code so it's big enough to scan on the page
export const GCASH_QR_IMAGE = '/images/gcash-qr.png';
export const GCASH_ACCOUNT_NAME = 'AN**L L** C.'; // written the way GCash shows it, so customers can check they're paying the right account
export const DAILY_SALES_TARGET = 50000;
export const MAX_LOGIN_ATTEMPTS = 5;

export const COLLECTIONS = [
  { value: 'all', label: 'All products' },
  { value: 'best_sellers', label: 'Best sellers' },
  { value: 'limited', label: 'Limited' },
] as const;

// home page "our categories": which product's photo stands for each category (category name -> product_id).
// Categories not listed here use their first product with a photo.
export const CATEGORY_PHOTOS: Record<string, number> = {
  Bedroom: 47, // Scandinavian Oak Queen Bed
  'Living Room': 11, // Modern Track-Arm Sofa
  'Home Office': 105, // Ergonomic Mesh Chair with Adjustable Armrests
  'Room Storage': 27, // Tall 5-Drawer Tri-Tone Wooden High Chest
  'Kitchen Dining': 24, // Middle Brown Oak Veneer Dining Board with Wine Rack and Rattan Door
};

// checkout: must match DELIVERY_FEE and COURIERS in backend/app/config.py
export const DELIVERY_FEE = 100;
export const COURIERS = ['J&T Express', 'LBC', 'Flash Express', 'Ninja Van'] as const;
export const DELIVERY_DAYS = [3, 5]; // shown as "Estimated Oct 13-15"
export const STORE_ADDRESS = 'General Luna cor. Muralla St, Intramuros, Manila, 1002 Metro Manila';
export const STORE_LOCATION: [number, number] = [14.58689, 120.97636]; // lat, lng of STORE_ADDRESS, where deliveries start on the tracking map
export const STORE_HOURS = 'Mon–Sat, 9AM–6PM';
export const STORE_PHONE = '+63 912 345 6789';
export const STORE_EMAIL = 'comfyandco@gmail.com';
export const ACCOUNT_DELETE_DAYS = 30; // a deactivated account is deleted this many days later (backend DELETE_AFTER_DAYS)
export const STORE_SOCIAL = '@comfyandco';
