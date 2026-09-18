'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { StorefrontShell } from '@/components/layout/storefront-shell';
import { ProfileEditor } from '@/components/account/profile-editor';
import { OrderHistory } from '@/components/account/order-history';
import { MyReservations } from '@/components/account/my-reservations';
import { Spinner } from '@/components/ui/spinner';

export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== 'customer') {
      router.replace('/staff');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <StorefrontShell>
        <div className="flex min-h-screen items-center justify-center">
          <Spinner label="Loading account…" />
        </div>
      </StorefrontShell>
    );
  }

  if (!user || user.role !== 'customer') return null;

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8 border-b border-char-hairline pb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-bone">
            Your account
          </h1>
          <p className="mt-3 text-sm text-bone-dim">
            Keep your dietary preferences, allergies, and contact details up to date so the kitchen
            cooks for you.
          </p>
        </header>

        <div className="space-y-8">
          <ProfileEditor />
          <OrderHistory />
          <MyReservations />
        </div>
      </section>
    </StorefrontShell>
  );
}