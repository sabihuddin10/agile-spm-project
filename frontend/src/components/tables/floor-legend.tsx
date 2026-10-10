import type { Table, TableStatus } from '@/types';
import { TABLE_STATUS } from '@/lib/format';
import { dotClass } from './status-style';

/** Status colour key with a live count per status (US6.2). */
export function FloorLegend({ tables, statuses }: { tables: Table[]; statuses: TableStatus[] }) {
  const held = tables.filter((t) => t.held).length;
  const seats = tables.reduce((sum, t) => sum + t.seats, 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" aria-label="Table status legend">
      {statuses.map((status) => {
        const count = tables.filter((t) => t.status === status).length;
        return (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-xs shadow-sm sm:gap-2 sm:px-3 sm:py-1 sm:text-sm"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${dotClass(status)}`} aria-hidden="true" />
            <span className="text-stone-600">{TABLE_STATUS[status].label}</span>
            <span className="font-semibold tabular-nums text-stone-900">{count}</span>
          </span>
        );
      })}
      {held > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700 sm:px-3 sm:py-1 sm:text-sm">
          Held <span className="font-semibold tabular-nums">{held}</span>
        </span>
      ) : null}
      <span className="ml-auto text-xs text-stone-500">
        {tables.length} tables · {seats} seats
      </span>
    </div>
  );
}
