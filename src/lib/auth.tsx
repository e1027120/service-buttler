import type { Session, User } from '@supabase/supabase-js';
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PageLoader } from '../components/ui';
import { initRuntimeConfig, supabase } from './supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState>({ session: null, user: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function init() {
      // Check if credentials need hydration from /api/config
      await initRuntimeConfig();

      if (!active) return;

      try {
        const { data } = await supabase.auth.getSession();
        if (active) setSession(data.session);
      } catch (err) {
        console.warn('Error fetching session:', err);
      } finally {
        if (active) setLoading(false);
      }

      const { data } = supabase.auth.onAuthStateChange((_event, s) => {
        if (active) setSession(s);
      });

      return () => {
        data.subscription.unsubscribe();
      };
    }

    const cleanupPromise = init();
    return () => {
      active = false;
      cleanupPromise.then((clean) => clean && clean());
    };
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
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
