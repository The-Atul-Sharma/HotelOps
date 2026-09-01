import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/shared/states';

export function RequireAuth() {
  const { user, ready } = useAuth();
  if (!ready) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
