import { http } from '@/lib/http';
import type { OrderStat, RefundStat } from '@/types/db';
import type { DeliveryQuote, OrderQuery, OrderWithItems, PlaceOrderInput, RiderOrder } from '@/types/models';

export const orderService = {
  place: (input: PlaceOrderInput) => http<OrderWithItems>('/orders', { method: 'POST', body: input }),
  // the vehicle, distance and fee for the items going to this address (or map pin)
  quoteDelivery: (q: { lines: { prod_var_id: number; quantity: number }[]; st_add: string; postal: string | null; city_id: number; lat: number | null; lng: number | null }) =>
    http<DeliveryQuote>('/orders/delivery-quote', { method: 'POST', body: q }),
  getMine: () => http<OrderWithItems[]>('/orders/me'),
  getById: (orderId: number) => http<OrderWithItems>(`/orders/${orderId}`),
  cancel: (orderId: number, reason: string) => http<OrderWithItems>(`/orders/${orderId}/cancel`, { method: 'POST', body: { reason } }),
  markReceived: (orderId: number) => http<OrderWithItems>(`/orders/${orderId}/received`, { method: 'POST' }),
  // after the rider marked it delivered: did the customer really get it?
  deliveryFeedback: (orderId: number, received: boolean, details?: string) =>
    http<OrderWithItems>(`/orders/${orderId}/delivery-feedback`, { method: 'POST', body: { received, details } }),
  confirmGcash: (orderId: number, reference: string) =>
    http<OrderWithItems>(`/orders/${orderId}/gcash/confirm`, { method: 'POST', body: { reference } }),
  requestRefund: (orderId: number, reason: string, details: string, photos: string[]) =>
    http<OrderWithItems>(`/orders/${orderId}/refund`, { method: 'POST', body: { reason, details, photos } }),
  uploadRefundPhoto: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http<{ url: string }>('/orders/uploads', { method: 'POST', body: form });
  },

  // admin
  getAll: (query: OrderQuery = {}) => http<OrderWithItems[]>('/admin/orders', { params: { status: query.status, q: query.q } }),
  getOne: (orderId: number) => http<OrderWithItems>(`/admin/orders/${orderId}`), // with the receipt's QR token
  updateStatus: (orderId: number, status: OrderStat) =>
    http<OrderWithItems>(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: { order_stat: status } }),
  decideGcash: (orderId: number, decision: 'confirm' | 'reject') =>
    http<OrderWithItems>(`/admin/orders/${orderId}/payment`, { method: 'PATCH', body: { decision } }),
  updateRefund: (orderId: number, status: RefundStat) =>
    http<OrderWithItems>(`/admin/orders/${orderId}/refund`, { method: 'PATCH', body: { refund_stat: status } }),
};

// the Lalamove rider's page, opened from the QR code on the receipt (no login, the token is the key)
export const deliveryService = {
  get: (orderNum: string, token: string) => http<RiderOrder>(`/delivery/${encodeURIComponent(orderNum)}/${encodeURIComponent(token)}`),
  confirm: (orderNum: string, token: string, photos: File[]) => {
    const form = new FormData();
    for (const p of photos) form.append('photos', p);
    return http<RiderOrder>(`/delivery/${encodeURIComponent(orderNum)}/${encodeURIComponent(token)}/confirm`, { method: 'POST', body: form });
  },
  failed: (orderNum: string, token: string, reason: string, note: string) => {
    const form = new FormData();
    form.append('reason', reason);
    if (note) form.append('note', note);
    return http<RiderOrder>(`/delivery/${encodeURIComponent(orderNum)}/${encodeURIComponent(token)}/failed`, { method: 'POST', body: form });
  },
};
