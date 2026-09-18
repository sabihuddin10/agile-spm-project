import { StorefrontShell } from '@/components/layout/storefront-shell';
import { PublicMenu } from '@/components/menu/public-menu';

export default function MenuPage() {
  return (
    <StorefrontShell>
      <section className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-8 border-b border-char-hairline pb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-bone">
            The menu
          </h1>
          <p className="mt-3 max-w-2xl text-bone-dim">
            Everything we are cooking tonight, with dietary notes and allergens on every dish.
            Order ahead straight from the pass.
          </p>
        </header>
        <PublicMenu />
      </section>
    </StorefrontShell>
  );
}