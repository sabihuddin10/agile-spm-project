import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Tone } from '@/lib/format';
import { Badge } from '@/components/ui/badge';

/**
 * A live number on the staff overview that links to the screen where it's acted
 * on. `flag` adds a status badge (e.g. "Action needed") when the value needs attention.
 */
export function LiveTile({
  href,
  label,
  value,
  hint,
  flag,
  loading = false,
}: {
  href: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  flag?: { tone: Tone; label: string } | null;
  loading?: boolean;
}) {
  return (
    <Link
      href={href}
      className="card group flex min-w-0 flex-col !p-4 transition hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-2xl font-semibold text-stone-900">
          {loading ? (
            <>
              <span className="inline-block h-7 w-12 animate-pulse rounded bg-stone-100 align-middle" aria-hidden="true" />
              <span className="sr-only">Loading</span>
            </>
          ) : (
            value
          )}
        </p>
        {flag && !loading ? <Badge tone={flag.tone}>{flag.label}</Badge> : null}
      </div>
      {hint ? <p className="mt-0.5 text-xs text-stone-500">{hint}</p> : null}
      <p className="mt-auto pt-2 text-xs font-medium text-stone-400 group-hover:text-brand-700">
        Open <span aria-hidden="true">→</span>
      </p>
    </Link>
  );
}

/** Heading + grid wrapper for a group of live tiles. */
export function TileGroup({ title, children, cols = 3 }: { title: string; children: ReactNode; cols?: 3 | 6 }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
      <div className={`grid grid-cols-2 gap-3 ${cols === 6 ? 'sm:grid-cols-3 2xl:grid-cols-6' : 'sm:grid-cols-3'}`}>{children}</div>
    </section>
  );
}
