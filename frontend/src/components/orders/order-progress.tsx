import type { OrderStatus } from '@/types';
import { ORDER_FLOW, ORDER_STATUS } from '@/lib/format';

/**
 * Compact lifecycle indicator: placed → confirmed → preparing → ready → served
 * → closed (US3.3). Step labels appear from the `sm` breakpoint; screen readers
 * always get the full list with the current step marked.
 */
export function OrderProgress({ status, className = '' }: { status: OrderStatus; className?: string }) {
  if (status === 'cancelled') {
    return (
      <div className={className}>
        <span className="block h-1.5 rounded-full bg-red-200" aria-hidden="true" />
        <p className="mt-1 text-xs font-medium text-red-600">Cancelled</p>
      </div>
    );
  }

  const current = ORDER_FLOW.indexOf(status);
  return (
    <ol className={`grid grid-cols-6 gap-1 ${className}`} aria-label="Order progress">
      {ORDER_FLOW.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={step} className="min-w-0" aria-current={state === 'current' ? 'step' : undefined}>
            <span
              aria-hidden="true"
              className={`block h-1.5 rounded-full ${
                state === 'done' ? 'bg-brand-300' : state === 'current' ? 'bg-brand-600' : 'bg-stone-200'
              }`}
            />
            <span
              aria-hidden="true"
              className={`mt-1 hidden truncate text-xs sm:block ${
                state === 'current' ? 'font-semibold text-brand-700' : 'text-stone-500'
              }`}
            >
              {ORDER_STATUS[step].label}
            </span>
            <span className="sr-only">
              {ORDER_STATUS[step].label}
              {state === 'done' ? ' (done)' : state === 'current' ? ' (current)' : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
