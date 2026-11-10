export const LOW_STOCK_LIMIT = 5;

// the store's GCash QR, from the GCash app, cropped to just the code so it's big enough to scan on the page
export const GCASH_QR_IMAGE = '/images/gcash-qr.png';
export const GCASH_ACCOUNT_NAME = 'AN**L L** C.'; // written the way GCash shows it, so customers can check they're paying the right account
export const DAILY_SALES_TARGET = 50000;
export const MAX_LOGIN_ATTEMPTS = 5;
// typing limits (the backend checks the same: MAX_EMAIL, MAX_PASSWORD, MAX_MESSAGE_WORDS in app/schemas.py)
export const MAX_EMAIL = 30;
export const MAX_PASSWORD = 30;
export const MAX_MESSAGE_WORDS = 200; // Contact Us message
export const MAX_SEARCH = 30; // every search box

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

// every delivery is one Lalamove booking (backend COURIER); the fee comes from POST /orders/delivery-quote
export const COURIER = 'Lalamove';
export const DELIVERY_DAYS = [3, 5]; // shown as "Estimated Oct 13-15"
export const STORE_ADDRESS = 'General Luna cor. Muralla St, Intramuros, Manila, 1002 Metro Manila';
export const STORE_LOCATION: [number, number] = [14.58689, 120.97636]; // lat, lng of STORE_ADDRESS, where deliveries start on the tracking map
export const STORE_HOURS = 'Mon–Sat, 9AM–6PM';
export const STORE_PHONE = '+63 912 345 6789';
export const STORE_EMAIL = 'comfyandco@gmail.com';
export const ACCOUNT_DELETE_DAYS = 30; // a deactivated account is deleted this many days later (backend DELETE_AFTER_DAYS)
