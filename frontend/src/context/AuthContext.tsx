import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService } from '@/services/authService';
import type { Session, UserProfile } from '@/types/models';

interface AuthValue {
  user: UserProfile | null;
  loading: boolean; // true while checking the saved session on first load
  signIn: (session: Session) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService
      .getSession()
      .then((session) => setUser(session?.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback((session: Session) => setUser(session.user), []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, signIn, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
