import { http } from '@/lib/http';
import type { DashboardSummary, SalesRange } from '@/types/admin';

export const dashboardService = {
  getSummary: (range: SalesRange = '7d') => http<DashboardSummary>('/admin/dashboard', { params: { range } }),
};
