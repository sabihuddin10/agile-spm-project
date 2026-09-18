'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Role, User } from '@/types';
import { authApi, clearAuth, getStoredToken, getStoredUser, storeAuth } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const PUBLIC_PATHS = ['/login', '/register'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser<User>());
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [loading, setLoading] = useState(true);

  // Validate the stored session against the server once on mount.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const t = getStoredToken();
      if (!t) {
        setLoading(false);
        return;
      }
      try {
        const u = getStoredUser<User>();
        if (u) {
          // Light optimization: trust stored user; full re-validation happens on next API 401.
          if (!cancelled) setUser(u);
          setLoading(false);
          return;
        }
        const { user: fresh } = await authApi.me();
        if (!cancelled) {
          setUser(fresh);
          setToken(t);
          storeAuth(t, fresh);
        }
      } catch {
        if (!cancelled) {
          clearAuth();
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u, token: t } = await authApi.login(email, password);
    setUser(u);
    setToken(t);
    storeAuth(t, u);
    return u;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user: u, token: t } = await authApi.register(name, email, password);
    setUser(u);
    setToken(t);
    storeAuth(t, u);
    return u;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    setToken(null);
  }, []);

  const hasRole = useCallback(
    (roles: Role[]) => {
      const rank: Record<Role, number> = { customer: 0, waiter: 1, chef: 2, manager: 3, admin: 4 };
      if (!user) return false;
      return rank[user.role] >= Math.max(...roles.map((r) => rank[r]));
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, hasRole }),
    [user, token, loading, login, register, logout, hasRole],
  );

  // Guard viewport redirects per zone.
  useEffect(() => {
    if (loading || typeof window === 'undefined') return;
    const path = window.location.pathname;
    const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
    // Public storefront zone: home + /menu + guest-visible pages.
    const isPublicZone = path === '/' || path.startsWith('/menu');

    if (!user) {
      // Authenticated-only zones redirect to /login.
      const protectedZone = path.startsWith('/staff') || path.startsWith('/dev') || path.startsWith('/account');
      if (protectedZone && !isPublic) window.location.assign('/login');
      return;
    }

    if (isPublic) {
      // Logged-in users skip auth screens → their role home.
      window.location.assign(user.role === 'customer' ? '/' : '/staff');
      return;
    }

    // Customers must not enter the staff zone.
    if (path.startsWith('/staff') && user.role === 'customer' && !isPublicZone) {
      window.location.assign('/');
    }
  }, [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}