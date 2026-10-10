import { StorefrontShell } from '@/components/layout/storefront-shell';
import { PublicMenu } from '@/components/menu/public-menu';

export default function MenuPage() {
  return (
    <StorefrontShell>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        <header className="mb-6 border-b border-char-hairline pb-6 md:mb-8 md:pb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-bone">
            The menu
          </h1>
          <p className="mt-3 max-w-2xl text-bone-dim">
            Everything we are cooking tonight, with dietary notes and allergens on every dish.
            Order for pickup, delivery or straight to your table.
          </p>
        </header>
        <PublicMenu />
      </section>
    </StorefrontShell>
  );
}