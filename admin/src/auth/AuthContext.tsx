import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, apiClient, tokenStore } from '../api';
import type { AuthResponse, User } from '../api/types';
import { isStaffRole } from '../lib/roles';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; reason?: 'expired' | 'logout' }
  | { status: 'authenticated'; user: User };

interface AuthContextValue {
  state: AuthState;
  user: User | null;
  /** Accepts a verified OTP session. Returns false (and revokes it) if the role may not use the admin app. */
  signIn(session: AuthResponse): Promise<boolean>;
  signOut(): Promise<void>;
  setUser(user: User): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(() =>
    tokenStore.getRefreshToken() ? { status: 'loading' } : { status: 'anonymous' },
  );

  // Wire the API client: a failed refresh ends the session; a successful one may update the user.
  useEffect(() => {
    apiClient.setHandlers({
      onAuthLost: () => {
        queryClient.clear();
        setState({ status: 'anonymous', reason: 'expired' });
      },
      onSession: (session) => {
        if (!isStaffRole(session.user.role)) {
          // Role was changed server-side: drop the session.
          void api.auth.logout().catch(() => undefined);
          queryClient.clear();
          setState({ status: 'anonymous', reason: 'expired' });
          return;
        }
        setState({ status: 'authenticated', user: session.user });
      },
    });
    return () => apiClient.setHandlers({});
  }, [queryClient]);

  // Restore the session after a page reload (the access token only lives in memory).
  useEffect(() => {
    if (!tokenStore.getRefreshToken()) return;
    let cancelled = false;
    apiClient.refresh().catch(() => {
      if (!cancelled) setState((s) => (s.status === 'loading' ? { status: 'anonymous' } : s));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (session: AuthResponse) => {
      tokenStore.setTokens(session.accessToken, session.refreshToken);
      if (!isStaffRole(session.user.role)) {
        await api.auth.logout().catch(() => undefined);
        return false;
      }
      queryClient.clear();
      setState({ status: 'authenticated', user: session.user });
      return true;
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* tokens are cleared anyway */
    } finally {
      queryClient.clear();
      setState({ status: 'anonymous', reason: 'logout' });
    }
  }, [queryClient]);

  const setUser = useCallback((user: User) => {
    setState((s) => (s.status === 'authenticated' ? { status: 'authenticated', user } : s));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, user: state.status === 'authenticated' ? state.user : null, signIn, signOut, setUser }),
    [state, signIn, signOut, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The signed-in user; only use below <RequireAuth>. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used without a signed-in user');
  return user;
}
