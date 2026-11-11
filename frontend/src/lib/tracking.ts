import type { OrderWithItems } from '@/types/models';
import { DELIVERY_DAYS, REFUND_DAYS } from './constants';

export type LatLng = [number, number];

// shipping_add is saved by the backend as "<address> (Standard Delivery via <courier>)" or "Store pickup. Customer address: <address>",
// with " [<wallet> submitted|paid|rejected, ref <reference>]" added for an e-wallet payment and " [Cancelled by buyer: <reason>]" when the customer cancels
export function parseShipping(shippingAdd: string) {
  const cancelReason = shippingAdd.match(/\s*\[Cancelled by buyer: (.+)\]$/)?.[1] ?? null;
  const text = shippingAdd.replace(/\s*\[Cancelled by buyer: .+\]$/, '').replace(/\s*\[(GCash|Maya|MariBank) (submitted|paid|rejected), ref [A-Za-z0-9]+\]$/, '');
  const pickup = text.startsWith('Store pickup');
  const courier = text.match(/\(Standard Delivery via (.+)\)$/)?.[1] ?? null;
  const address = text.replace(/^Store pickup\. Customer address: /, '').replace(/\s*\(Standard Delivery via .+\)$/, '');
  return { pickup, courier, address, cancelReason };
}

// the Track Order tabs. A pending e-wallet order is "To pay" until it's paid.
export const ORDER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'to_pay', label: 'To Pay' },
  { key: 'to_ship', label: 'To Ship' },
  { key: 'to_receive', label: 'To Receive' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'refund', label: 'Refund' },
] as const;
export type OrderTab = (typeof ORDER_TABS)[number]['key'];

export function orderTab(order: Pick<OrderWithItems, 'order_stat' | 'payment_method' | 'refund' | '_temp_payment_status'>): OrderTab {
  if (order.refund) return 'refund';
  switch (order.order_stat) {
    case 'Pending':
      return order.payment_method === 'GCash' && order._temp_payment_status !== 'Paid' ? 'to_pay' : 'to_ship';
    case 'Shipped':
      return 'to_receive';
    case 'Delivered':
      return 'completed';
    default:
      return 'cancelled';
  }
}

type PaymentFields = Pick<OrderWithItems, 'order_stat' | 'payment_method' | '_temp_payment_status' | '_temp_payment_ref' | '_temp_payment_wallet'>;

// how the payment reads on the order pages: the e-wallet once a reference number was sent, "E-wallet" before that.
// Older orders that already moved on have no payment record.
export function paymentLabel(order: PaymentFields) {
  if (order.payment_method === 'COD') return 'Cash on Delivery';
  const ref = order._temp_payment_ref;
  const wallet = order._temp_payment_wallet ?? 'E-wallet';
  if (order._temp_payment_status === 'Paid') return `${wallet} · Paid (Ref. ${ref})`;
  if (order._temp_payment_status === 'For verification') return `${wallet} · Checking payment (Ref. ${ref})`;
  if (order.order_stat !== 'Pending') return wallet;
  return order._temp_payment_status === 'Rejected' ? `${wallet} · Payment not confirmed (Ref. ${ref})` : 'E-wallet · Not paid yet';
}

// the customer can still scan the QR and send a reference number
export function canPayGcash(order: PaymentFields) {
  return (
    order.payment_method === 'GCash' &&
    order.order_stat === 'Pending' &&
    order._temp_payment_status !== 'Paid' &&
    order._temp_payment_status !== 'For verification'
  );
}

// the rider marked it delivered and the customer hasn't said yet whether they got it
// the last moment a refund can be requested: REFUND_DAYS after the delivery (older orders without delivered_at count
// from when they were placed, same as the backend)
export function refundDeadline(order: Pick<OrderWithItems, 'delivered_at' | 'placed_at'>) {
  return new Date(Date.parse(order.delivered_at ?? order.placed_at) + REFUND_DAYS * 86400000);
}

export function refundOpen(order: Pick<OrderWithItems, 'order_stat' | 'refund' | 'delivered_at' | 'placed_at'>) {
  return order.order_stat === 'Delivered' && !order.refund && Date.now() <= refundDeadline(order).getTime();
}

export function awaitingReceipt(order: Pick<OrderWithItems, 'order_stat' | 'delivered_by' | 'receipt_confirmed_at' | 'not_received_at'>) {
  return order.order_stat === 'Delivered' && order.delivered_by === 'rider' && !order.receipt_confirmed_at && !order.not_received_at;
}

// There's no courier GPS, so the rider's spot on the map is estimated from the order status and how long ago it was placed.
// Shipped orders move from 10% to 90% of the route over the fastest delivery estimate.
export function deliveryProgress(order: OrderWithItems, now = Date.now()) {
  if (order.order_stat === 'Delivered') return 1;
  if (order.order_stat !== 'Shipped') return 0;
  const span = DELIVERY_DAYS[0] * 86400000;
  const elapsed = (now - Date.parse(order.placed_at)) / span;
  return Math.min(0.9, Math.max(0.1, elapsed));
}

const GEO_CACHE = 'comfyco.geocode';

function readCache(): Record<string, LatLng> {
  try {
    return JSON.parse(localStorage.getItem(GEO_CACHE) ?? '{}');
  } catch {
    return {};
  }
}

// OpenStreetMap's free geocoder. If the full address isn't found, the street is dropped and it tries again with just the city,
// unless `exact` is set: then only the full address counts (for placing a pin, which must not land in the middle of a city).
export async function geocode(address: string, { exact = false } = {}): Promise<LatLng | null> {
  const cache = readCache();
  const key = exact ? `exact:${address}` : address;
  if (cache[key]) return cache[key];

  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const tries = (exact ? [parts] : [parts, parts.slice(1), parts.slice(1, 2)]).filter((t) => t.length).map((t) => t.join(', '));
  for (const q of tries) {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(q)}`);
    if (!res.ok) continue;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    if (hit) {
      const point: LatLng = [Number(hit.lat), Number(hit.lon)];
      try {
        localStorage.setItem(GEO_CACHE, JSON.stringify({ ...cache, [key]: point }));
      } catch {
        // storage full or blocked, it just gets looked up again next time
      }
      return point;
    }
  }
  return null;
}

export interface FoundAddress {
  street: string; // "12 Malabito Street, San Martin de Porres" (house no., road, barangay), whatever OSM knows
  city: string; // "Quezon City", "Mandaluyong"
  postal: string; // "1111", or '' if unknown
}

// the address at a map point (used after "Use my current location" to fill in the address fields); null if OSM has nothing there
export async function reverseGeocode([lat, lng]: LatLng): Promise<FoundAddress | null> {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`);
  if (!res.ok) return null;
  const { address: a } = (await res.json()) as { address?: Record<string, string> };
  if (!a || a.country_code !== 'ph') return null;
  const barangay = a.quarter ?? a.neighbourhood ?? a.village ?? a.suburb ?? '';
  const street = [[a.house_number, a.road].filter(Boolean).join(' '), barangay].filter(Boolean).join(', ');
  const city = a.city ?? a.town ?? a.municipality ?? '';
  if (!street && !city) return null;
  return { street, city, postal: /^\d{4}$/.test(a.postcode ?? '') ? a.postcode! : '' };
}

// road route from the free OSRM demo server, falls back to a straight line
export async function roadRoute(from: LatLng, to: LatLng): Promise<LatLng[]> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`,
    );
    const data = await res.json();
    const coords: [number, number][] | undefined = data.routes?.[0]?.geometry?.coordinates;
    if (coords?.length) return coords.map(([lng, lat]) => [lat, lng]);
  } catch {
    // route server down
  }
  return [from, to];
}

// splits the route at the rider's spot: the part already driven and the part left
export function splitRoute(route: LatLng[], progress: number) {
  const dist = (a: LatLng, b: LatLng) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const total = route.slice(1).reduce((sum, p, i) => sum + dist(route[i], p), 0);
  let left = total * progress;
  for (let i = 1; i < route.length; i++) {
    const step = dist(route[i - 1], route[i]);
    if (left <= step) {
      const t = step ? left / step : 0;
      const here: LatLng = [route[i - 1][0] + (route[i][0] - route[i - 1][0]) * t, route[i - 1][1] + (route[i][1] - route[i - 1][1]) * t];
      return { done: [...route.slice(0, i), here], rest: [here, ...route.slice(i)], here };
    }
    left -= step;
  }
  const end = route[route.length - 1];
  return { done: route, rest: [end], here: end };
}
