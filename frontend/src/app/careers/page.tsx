import type { Metadata } from 'next';
import { StorefrontShell } from '@/components/layout/storefront-shell';
import { CareersForm } from '@/components/staff/careers-form';

export const metadata: Metadata = { title: 'Careers' };

const PERKS = [
  { title: 'A rota you can plan around', body: 'Shifts are published a week ahead and show up in your staff app.' },
  { title: 'Learn the fire', body: 'Cooks train on the wood-fired oven and grill; servers learn the menu at tastings.' },
  { title: 'Tips you can see', body: 'Tips are tracked on every order you look after.' },
];

/** Public careers page — "Join our team" application form (US9.1). */
export default function CareersPage() {
  return (
    <StorefrontShell>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember-soft">Careers</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-bone sm:text-5xl">
              Join our team
            </h1>
            <p className="mt-4 max-w-xl text-bone-dim">
              We&apos;re a small wood-fired bistro with a short seasonal menu and a kitchen that cooks around every
              guest&apos;s allergies. We&apos;re looking for waiters and chefs who care about good food and looking after
              people.
            </p>
            <p className="mt-3 max-w-xl text-bone-dim">
              Send us a few lines about yourself. A manager reviews every application and, if it&apos;s a fit, sets up
              your staff account so you can see your shifts from day one.
            </p>

            <ul className="mt-8 space-y-4">
              {PERKS.map((p) => (
                <li key={p.title} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ember" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-bone">{p.title}</p>
                    <p className="text-sm text-bone-dim">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <CareersForm />
          </div>
        </div>
      </section>
    </StorefrontShell>
  );
}
