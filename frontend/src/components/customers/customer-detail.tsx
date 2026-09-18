'use client';

import type { Customer } from '@/types';
import { Badge } from '@/components/ui/badge';

export function CustomerDetail({
  customer,
  onEdit,
  onDelete,
}: {
  customer: Customer;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const totalOrders = customer.orderHistory?.length ?? 0;
  const avgOrder = totalOrders > 0 ? (customer.totalSpend / totalOrders).toFixed(2) : '0.00';

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{customer.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
              <Badge tone={customer.type === 'online' ? 'blue' : 'stone'}>{customer.type}</Badge>
              {customer.email && <span>{customer.email}</span>}
              {customer.phone && <span>· {customer.phone}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onEdit} className="btn-secondary !px-3 !py-1.5 text-xs">
              Edit
            </button>
            <button onClick={onDelete} className="btn-danger !px-3 !py-1.5 text-xs">
              Delete
            </button>
          </div>
        </div>
        {customer.notes ? <p className="mt-2 text-sm text-stone-500">{customer.notes}</p> : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total spend" value={`$${customer.totalSpend.toFixed(2)}`} />
        <Stat label="Orders" value={String(totalOrders)} />
        <Stat label="Avg / order" value={`$${avgOrder}`} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Preferences</p>
        <div className="space-y-1.5 text-sm">
          <PrefRow label="Dietary" values={customer.preferences.dietary} />
          <PrefRow label="Allergies" values={customer.preferences.allergies} danger />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Order history</p>
        {totalOrders === 0 ? (
          <p className="text-sm text-stone-400">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
            {customer.orderHistory?.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-stone-800">{o.items.join(', ')}</p>
                  <p className="text-xs text-stone-400">{o.date}</p>
                </div>
                <span className="font-semibold">${o.total.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2.5 text-center">
      <p className="text-lg font-bold text-stone-800">{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{label}</p>
    </div>
  );
}

function PrefRow({ label, values, danger = false }: { label: string; values: string[]; danger?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-16 shrink-0 text-stone-500">{label}</span>
      {values.length === 0 ? (
        <span className="text-stone-400">None</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                danger ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}