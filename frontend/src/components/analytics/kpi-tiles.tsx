import type { AnalyticsDashboard } from '@/types';
import { count, currency, pct } from '@/components/analytics/analytics-format';

interface Tile {
  label: string;
  value: string;
  hint: string;
  wide?: boolean;
}

/** Headline KPIs for the selected period (US10.1): revenue, orders, average, tips, refunds, cancellations, customers. */
export function KpiTiles({ kpis }: { kpis: AnalyticsDashboard['kpis'] }) {
  const allOrders = kpis.orders + kpis.cancelled;
  const tiles: Tile[] = [
    { label: 'Revenue', value: currency(kpis.revenue), hint: 'Paid orders, net of refunds', wide: true },
    { label: 'Orders', value: count(kpis.orders), hint: 'Excluding cancelled' },
    { label: 'Avg order', value: currency(kpis.avgOrder), hint: 'Per paid order' },
    {
      label: 'Tips',
      value: currency(kpis.tips),
      hint: kpis.revenue ? `${pct(Math.round((kpis.tips / kpis.revenue) * 1000) / 10)} of revenue` : 'No paid orders',
    },
    { label: 'Refunds', value: currency(kpis.refunds), hint: 'Issued on orders in period' },
    {
      label: 'Cancelled',
      value: count(kpis.cancelled),
      hint: allOrders ? `${pct(Math.round((kpis.cancelled / allOrders) * 1000) / 10)} of all orders` : 'No orders',
    },
    { label: 'Customers', value: count(kpis.customers), hint: 'Unique guests on record' },
  ];

  return (
    // Pills like the order filter chips on phones (see .stat in globals.css), tiles from sm.
    <dl className="stat-row grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 2xl:grid-cols-8">
      {tiles.map((t) => (
        <div key={t.label} className={`stat card min-w-0 sm:!p-4 ${t.wide ? 'sm:col-span-2' : ''}`}>
          <dt className="stat-label text-xs font-medium text-stone-500">{t.label}</dt>
          <dd className={`stat-value mt-1 break-words font-semibold text-stone-900 ${t.wide ? 'text-3xl' : 'text-xl'}`}>{t.value}</dd>
          <dd className="stat-extra mt-0.5 text-xs text-stone-500">{t.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
