import { http } from '@/lib/http';
import type { OrderStat, RefundStat } from '@/types/db';
import type { OrderQuery, OrderWithItems, PlaceOrderInput } from '@/types/models';

export const orderService = {
  place: (input: PlaceOrderInput) => http<OrderWithItems>('/orders', { method: 'POST', body: input }),
  getMine: () => http<OrderWithItems[]>('/orders/me'),
  getById: (orderId: number) => http<OrderWithItems>(`/orders/${orderId}`),
  cancel: (orderId: number, reason: string) => http<OrderWithItems>(`/orders/${orderId}/cancel`, { method: 'POST', body: { reason } }),
  markReceived: (orderId: number) => http<OrderWithItems>(`/orders/${orderId}/received`, { method: 'POST' }),
  confirmGcash: (orderId: number) => http<OrderWithItems>(`/orders/${orderId}/gcash/confirm`, { method: 'POST' }),
  requestRefund: (orderId: number, reason: string, details: string) =>
    http<OrderWithItems>(`/orders/${orderId}/refund`, { method: 'POST', body: { reason, details } }),

  // admin
  getAll: (query: OrderQuery = {}) => http<OrderWithItems[]>('/admin/orders', { params: { status: query.status, q: query.q } }),
  updateStatus: (orderId: number, status: OrderStat) =>
    http<OrderWithItems>(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: { order_stat: status } }),
  updateRefund: (orderId: number, status: RefundStat) =>
    http<OrderWithItems>(`/admin/orders/${orderId}/refund`, { method: 'PATCH', body: { refund_stat: status } }),
};