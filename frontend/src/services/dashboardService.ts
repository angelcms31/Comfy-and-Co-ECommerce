import { http } from '@/lib/http';
import type { DashboardSummary } from '@/types/models';

export const dashboardService = {
  getSummary: () => http<DashboardSummary>('/admin/dashboard'),
};
