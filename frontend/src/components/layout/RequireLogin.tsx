import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';

// pages that need an account (profile, checkout), sends guests to log in and back
export default function RequireLogin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="container-page"><LoadingState layout="page" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  return <>{children}</>;
}
