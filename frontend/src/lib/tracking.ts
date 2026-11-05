import type { OrderWithItems } from '@/types/models';
import { DELIVERY_DAYS } from './constants';

export type LatLng = [number, number];

// shipping_add is saved by the backend as "<address> (Standard Delivery via <courier>)" or "Store pickup. Customer address: <address>",
// with " [GCash submitted|paid|rejected, ref <number>]" added for a GCash payment and " [Cancelled by buyer: <reason>]" when the customer cancels
export function parseShipping(shippingAdd: string) {
  const cancelReason = shippingAdd.match(/\s*\[Cancelled by buyer: (.+)\]$/)?.[1] ?? null;
  const text = shippingAdd.replace(/\s*\[Cancelled by buyer: .+\]$/, '').replace(/\s*\[GCash (submitted|paid|rejected), ref \d+\]$/, '');
  const pickup = text.startsWith('Store pickup');
  const courier = text.match(/\(Standard Delivery via (.+)\)$/)?.[1] ?? null;
  const address = text.replace(/^Store pickup\. Customer address: /, '').replace(/\s*\(Standard Delivery via .+\)$/, '');
  return { pickup, courier, address, cancelReason };
}

// the Track Order tabs. A pending GCash order is "To pay" until it's paid.
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

type PaymentFields = Pick<OrderWithItems, 'order_stat' | 'payment_method' | '_temp_payment_status' | '_temp_payment_ref'>;

// how the payment reads on the order pages. Older GCash orders that already moved on have no payment record.
export function paymentLabel(order: PaymentFields) {
  if (order.payment_method === 'COD') return 'Cash on Delivery';
  const ref = order._temp_payment_ref;
  if (order._temp_payment_status === 'Paid') return `GCash · Paid (Ref. ${ref})`;
  if (order._temp_payment_status === 'For verification') return `GCash · Checking payment (Ref. ${ref})`;
  if (order.order_stat !== 'Pending') return 'GCash';
  return order._temp_payment_status === 'Rejected' ? `GCash · Payment not confirmed (Ref. ${ref})` : 'GCash · Not paid yet';
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

// OpenStreetMap's free geocoder. If the full address isn't found, the street is dropped and it tries again with just the city.
export async function geocode(address: string): Promise<LatLng | null> {
  const cache = readCache();
  if (cache[address]) return cache[address];

  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const tries = [parts, parts.slice(1), parts.slice(1, 2)].filter((t) => t.length).map((t) => t.join(', '));
  for (const q of tries) {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(q)}`);
    if (!res.ok) continue;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    if (hit) {
      const point: LatLng = [Number(hit.lat), Number(hit.lon)];
      try {
        localStorage.setItem(GEO_CACHE, JSON.stringify({ ...cache, [address]: point }));
      } catch {
        // storage full or blocked, it just gets looked up again next time
      }
      return point;
    }
  }
  return null;
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
