import { http } from '@/lib/http';
import type { OrderStat, RefundStat } from '@/types/db';
import type { OrderQuery, OrderWithItems, PlaceOrderInput } from '@/types/models';

export const orderService = {
  place: (input: PlaceOrderInput) => http<OrderWithItems>('/orders', { method: 'POST', body: input }),
  getMine: () => http<OrderWithItems[]>('/orders/me'),
  getById: (orderId: number) => http<OrderWithItems>(`/orders/${orderId}`),
  cancel: (orderId: number, reason: string) => http<OrderWithItems>(`/orders/${orderId}/cancel`, { method: 'POST', body: { reason } }),
  markReceived: (orderId: number) => http<OrderWithItems>(`/orders/${orderId}/received`, { method: 'POST' }),
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
  updateStatus: (orderId: number, status: OrderStat) =>
    http<OrderWithItems>(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: { order_stat: status } }),
  decideGcash: (orderId: number, decision: 'confirm' | 'reject') =>
    http<OrderWithItems>(`/admin/orders/${orderId}/payment`, { method: 'PATCH', body: { decision } }),
  updateRefund: (orderId: number, status: RefundStat) =>
    http<OrderWithItems>(`/admin/orders/${orderId}/refund`, { method: 'PATCH', body: { refund_stat: status } }),
};