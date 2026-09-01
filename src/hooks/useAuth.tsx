import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useUsers } from '@/hooks/useEntities';
import {
  clearSession,
  fetchUserById,
  findUserByCredentials,
  getSessionUserId,
  setSessionUserId,
} from '@/services/auth';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(() => getSessionUserId());
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [resolving, setResolving] = useState(() => Boolean(getSessionUserId()));
  const { data: users = [], isLoading: usersLoading } = useUsers();

  useEffect(() => {
    let cancelled = false;

    async function resolveSession() {
      if (!sessionId) {
        setSessionUser(null);
        setResolving(false);
        return;
      }

      const cached = users.find((u) => u.id === sessionId && u.active);
      if (cached) {
        setSessionUser(cached);
        setResolving(false);
        return;
      }

      if (usersLoading) return;

      const fetched = await fetchUserById(sessionId);
      if (cancelled) return;

      if (!fetched) {
        clearSession();
        setSessionId(null);
        setSessionUser(null);
      } else {
        setSessionUser(fetched);
      }
      setResolving(false);
    }

    void resolveSession();
    return () => {
      cancelled = true;
    };
  }, [sessionId, users, usersLoading]);

  const login = useCallback(async (username: string, password: string) => {
    const matched = await findUserByCredentials(username, password);
    if (!matched) return false;
    setSessionUserId(matched.id);
    setSessionId(matched.id);
    setSessionUser(matched);
    setResolving(false);
    return true;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSessionId(null);
    setSessionUser(null);
  }, []);

  const ready = !usersLoading && !resolving;

  const value = useMemo(
    () => ({
      user: sessionUser,
      ready,
      login,
      logout,
    }),
    [sessionUser, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
