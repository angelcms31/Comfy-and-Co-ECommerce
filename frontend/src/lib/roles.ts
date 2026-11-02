import type { UserRoleName } from '@/types/db';

// Super Admin can do everything an Admin can, plus Settings (admins, store info, audit logs)
export const isAdmin = (user: { role: UserRoleName } | null | undefined) => user?.role === 'admin' || user?.role === 'super_admin';
export const isSuperAdmin = (user: { role: UserRoleName } | null | undefined) => user?.role === 'super_admin';

export const ROLE_LABEL: Record<UserRoleName, string> = { customer: 'Customer', admin: 'Admin', super_admin: 'Super Admin' };
