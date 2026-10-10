import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { BrandLink } from '@/components/storefront/flame-mark';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="storefront relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-char px-4 py-8 md:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(50%_100%_at_50%_0%,rgba(226,87,27,0.22),transparent)]"
      />
      <BrandLink className="relative mb-6 md:mb-8" />
      <div className="relative w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}
