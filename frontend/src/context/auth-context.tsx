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
  /** Re-fetch the signed-in user (e.g. after an admin changes their role). */
  refreshUser: () => Promise<void>;
  /**
   * Replace the signed-in user (and, when given, the session token) after a
   * self-service change. Changing your password revokes every other session and
   * issues a new token, which must be stored here to stay signed in.
   */
  updateSession: (user: User, token?: string) => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_PATHS = ['/login', '/register'];
const PROTECTED_PREFIXES = ['/staff', '/dev', '/account'];

export const AUTH_EXPIRED_EVENT = 'auth:expired';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const t = getStoredToken();
    if (!t) return;
    try {
      const { user: fresh } = await authApi.me();
      setUser(fresh);
      setToken(t);
      storeAuth(t, fresh);
    } catch {
      /* a 401 is handled by the auth:expired listener below */
    }
  }, []);

  // Restore the stored session instantly, then re-validate it with the server so
  // role changes and suspensions apply on the next page load (US9.2, US9.4).
  useEffect(() => {
    const t = getStoredToken();
    const stored = getStoredUser<User>();
    if (t && stored) {
      setUser(stored);
      setToken(t);
    }
    setLoading(false);
    if (t) refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    function onExpired() {
      setUser(null);
      setToken(null);
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
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

  const updateSession = useCallback((u: User, t?: string) => {
    const next = t ?? getStoredToken();
    setUser(u);
    if (!next) return;
    setToken(next);
    storeAuth(next, u);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    setToken(null);
  }, []);

  const hasRole = useCallback((...roles: Role[]) => Boolean(user && roles.includes(user.role)), [user]);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refreshUser, updateSession, hasRole }),
    [user, token, loading, login, register, logout, refreshUser, updateSession, hasRole],
  );

  // Zone guards: signed-out users leave protected zones; signed-in users skip
  // the auth screens; customers never see the staff console.
  useEffect(() => {
    if (loading) return;
    const path = window.location.pathname;
    const onAuthPage = AUTH_PATHS.some((p) => path.startsWith(p));

    if (!user) {
      if (PROTECTED_PREFIXES.some((p) => path.startsWith(p))) window.location.assign('/login');
      return;
    }
    if (onAuthPage) {
      window.location.assign(user.role === 'customer' ? '/' : '/staff');
      return;
    }
    if (path.startsWith('/staff') && user.role === 'customer') {
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
