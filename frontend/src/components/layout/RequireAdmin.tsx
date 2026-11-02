import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import { isAdmin, isSuperAdmin } from '@/lib/roles';

// the backend checks the role too, this just keeps customers out of the admin pages
export default function RequireAdmin({ children, superOnly }: { children: ReactNode; superOnly?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="container-page"><LoadingState layout="page" /></div>;
  if (!user) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  if (!isAdmin(user)) return <Navigate to="/" replace />;
  if (superOnly && !isSuperAdmin(user)) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
