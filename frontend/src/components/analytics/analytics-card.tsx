import type { ReactNode } from 'react';

/** Card shell for one analytics panel: heading, user-story tag, optional action. */
export function AnalyticsCard({
  title,
  story,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  story: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = `${story.replace(/\W/g, '')}-heading`;
  return (
    <section className={`card flex min-w-0 flex-col ${className}`} aria-labelledby={headingId}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} className="text-base font-semibold text-stone-900">
              {title}
            </h2>
            <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-stone-500">
              {story}
            </span>
          </div>
          {subtitle ? <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Collapsible table twin for a chart, so no value is tooltip-only. */
export function DataTableToggle({ children, label = 'View data table' }: { children: ReactNode; label?: string }) {
  return (
    <details className="group mt-3 text-sm">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1 rounded text-xs font-medium text-stone-500 hover:text-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <span className="transition group-open:rotate-90" aria-hidden="true">
          ▸
        </span>
        {label}
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-stone-200">{children}</div>
    </details>
  );
}

/** Segmented toggle buttons (e.g. By quantity / By revenue); the pressed one is active. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'sm',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-stone-200 bg-stone-50 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`rounded-md font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
            } ${active ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200' : 'text-stone-500 hover:text-stone-800'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
