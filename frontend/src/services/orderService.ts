import { http } from '@/lib/http';
import type { OrderStat } from '@/types/db';
import type { OrderQuery, OrderWithItems, PlaceOrderInput } from '@/types/models';

export const orderService = {
  place: (input: PlaceOrderInput) => http<OrderWithItems>('/orders', { method: 'POST', body: input }),
  getMine: () => http<OrderWithItems[]>('/orders/me'),
  getById: (orderId: number) => http<OrderWithItems>(`/orders/${orderId}`),
  confirmGcash: (orderId: number) => http<OrderWithItems>(`/orders/${orderId}/gcash/confirm`, { method: 'POST' }),

  // admin
  getAll: (query: OrderQuery = {}) => http<OrderWithItems[]>('/admin/orders', { params: { status: query.status, q: query.q } }),
  updateStatus: (orderId: number, status: OrderStat) =>
    http<OrderWithItems>(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: { order_stat: status } }),
};
