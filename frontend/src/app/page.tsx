import Link from 'next/link';
import { StorefrontShell } from '@/components/layout/storefront-shell';
import { PublicMenu } from '@/components/menu/public-menu';

export default function HomePage() {
  return (
    <StorefrontShell>
      <section className="border-b border-char-hairline bg-char-deep">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-bone sm:text-6xl">
                The fire sets the menu.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-bone-dim">
                Wood-fired plates and plant-led sides that change with the season. Order ahead from
                the pass, or pull up a chair and let the kitchen cook to you.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/menu" className="btn-primary">
                  Order online
                </Link>
                <Link href="/book" className="btn-secondary">
                  Book a table
                </Link>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-char-hairline bg-char-raised">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(226,87,27,0.35),transparent)]"
              />
              <div className="relative p-7">
                <p className="font-display text-2xl font-semibold tracking-tight text-bone">
                  Tonight at the pass
                </p>
                <p className="mt-2 text-sm leading-relaxed text-bone-dim">
                  Kitchen open all week, noon to ten. Orders off the pass in about half an hour;
                  tables book from six.
                </p>
                <div className="mt-6 space-y-2.5 divide-y divide-char-hairline text-sm">
                  <p className="flex items-baseline justify-between pt-2.5 first:pt-0">
                    <span className="text-bone-dim">Kitchen</span>
                    <span className="text-bone">12:00–22:00</span>
                  </p>
                  <p className="flex items-baseline justify-between pt-2.5 first:pt-0">
                    <span className="text-bone-dim">Order pickup</span>
                    <span className="text-bone">~30 minutes</span>
                  </p>
                  <p className="flex items-baseline justify-between pt-2.5 first:pt-0">
                    <span className="text-bone-dim">Dinner service</span>
                    <span className="text-bone">from 18:00</span>
                  </p>
                </div>
                <p className="mt-6 text-sm text-ember-soft">
                  <Link href="/book" className="hover:text-bone">
                    Reserve tonight
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6">
        <div className="flex items-center gap-8 divide-x divide-char-hairline py-8 text-sm text-bone-dim">
          <span>Wood-fired grill, in season</span>
          <span className="pl-8">Short menu that changes</span>
          <span className="hidden pl-8 sm:block">Cooks around allergies</span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-bone">
              From the pass tonight
            </h2>
            <p className="mt-2 text-sm text-bone-dim">
              Every dish lists its allergens and dietary notes. Add what you fancy and place an
              online order.
            </p>
          </div>
        </div>

        <PublicMenu compact />
      </section>
    </StorefrontShell>
  );
}