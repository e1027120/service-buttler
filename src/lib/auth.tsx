import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PageLoader } from '../components/ui';
import { api, getAuthToken } from './api';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  has_password?: boolean;
}

export interface AuthSession {
  id: string;
  user: AuthUser;
}

interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthCtx = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setSession(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.auth.me();
      if (data?.user) {
        setUser(data.user);
        setSession({ id: data.session.id, user: data.user });
      } else {
        setUser(null);
        setSession(null);
      }
    } catch {
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const signOut = async () => {
    await api.auth.logout();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthCtx.Provider
      value={{
        session,
        user,
        loading,
        signOut,
        refreshUser: loadUser,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}
