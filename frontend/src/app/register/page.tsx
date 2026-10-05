import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/components/auth/register-form';
import { BrandLink } from '@/components/storefront/flame-mark';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <main className="storefront relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-char px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(50%_100%_at_50%_0%,rgba(226,87,27,0.22),transparent)]"
      />
      <BrandLink className="relative mb-8" />
      <div className="relative w-full max-w-md">
        <RegisterForm />
        <p className="mt-4 text-center text-sm text-bone-dim">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-ember-soft hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
