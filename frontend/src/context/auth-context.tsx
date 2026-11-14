'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Role, User } from '@/types';
import { ApiError, AUTH_EXPIRED_EVENT, authApi, clearLegacyAuth } from '@/lib/api';
import { setWorkforceMockUser } from '@/lib/workforce-api';

export { AUTH_EXPIRED_EVENT } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signingOut: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<boolean>;
  /** Re-fetch the signed-in user (e.g. after an admin changes their role). */
  refreshUser: () => Promise<void>;
  updateSession: (user: User) => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_PATHS = ['/login', '/register'];
const PROTECTED_PREFIXES = ['/staff', '/dev', '/account'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [expired, setExpired] = useState(false);
  const generation = useRef(0);
  const currentUser = useRef<User | null>(null);
  const logoutPending = useRef(false);

  const replaceUser = useCallback((next: User | null) => {
    generation.current += 1;
    currentUser.current = next;
    setWorkforceMockUser(next);
    setUser(next);
  }, []);

  const expire = useCallback(() => {
    if (!currentUser.current) return;
    setExpired(true);
    replaceUser(null);
  }, [replaceUser]);

  const refreshUser = useCallback(async () => {
    const started = generation.current;
    try {
      const { user: fresh } = await authApi.me();
      if (started === generation.current) replaceUser(fresh);
    } catch (error) {
      if (started === generation.current && error instanceof ApiError && error.status === 401) expire();
    }
  }, [expire, replaceUser]);

  useEffect(() => {
    clearLegacyAuth();
    let mounted = true;
    void refreshUser().finally(() => { if (mounted) setLoading(false); });
    return () => {
      mounted = false;
      generation.current += 1;
    };
  }, [refreshUser]);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
  }, [expire]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u } = await authApi.login(email, password);
    setExpired(false);
    replaceUser(u);
    return u;
  }, [replaceUser]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user: u } = await authApi.register(name, email, password);
    setExpired(false);
    replaceUser(u);
    return u;
  }, [replaceUser]);

  const logout = useCallback(async () => {
    if (logoutPending.current) return false;
    logoutPending.current = true;
    setSigningOut(true);
    setLogoutError(false);
    try {
      await authApi.logout();
      replaceUser(null);
      return true;
    } catch {
      setLogoutError(true);
      return false;
    } finally {
      logoutPending.current = false;
      setSigningOut(false);
    }
  }, [replaceUser]);

  const hasRole = useCallback((...roles: Role[]) => Boolean(user && roles.includes(user.role)), [user]);

  const value = useMemo(
    () => ({ user, loading, signingOut, login, register, logout, refreshUser, updateSession: replaceUser, hasRole }),
    [user, loading, signingOut, login, register, logout, refreshUser, replaceUser, hasRole],
  );

  // Zone guards: signed-out users leave protected zones; signed-in users skip
  // the auth screens; customers never see the staff console.
  useEffect(() => {
    if (loading) return;
    const path = window.location.pathname;
    const onAuthPage = AUTH_PATHS.some((p) => path.startsWith(p));

    if (!user) {
      if (PROTECTED_PREFIXES.some((p) => path.startsWith(p))) window.location.assign(expired ? '/login?expired=1' : '/login');
      return;
    }
    if (onAuthPage) {
      window.location.assign(user.role === 'customer' ? '/' : '/staff');
      return;
    }
    if (path.startsWith('/staff') && user.role === 'customer') {
      window.location.assign('/');
    }
  }, [user, loading, expired]);

  return (
    <AuthContext.Provider value={value}>
      {logoutError && user ? <p role="alert" className="fixed inset-x-4 bottom-4 z-50 rounded-lg bg-red-900 p-3 text-white">Could not sign out. Please try again.</p> : null}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
