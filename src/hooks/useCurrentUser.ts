import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types';

export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('Not authenticated');
  return user;
}

export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === 'Admin';
}
