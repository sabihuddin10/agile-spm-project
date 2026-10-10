import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  // Compact on phones; callers that set their own padding (p-0, p-6 ...) keep it.
  const padding = /(^|\s)!?p-/.test(className) ? '' : 'p-4 sm:p-5 ';
  return <div className={`card ${padding}${className}`.trim()}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}