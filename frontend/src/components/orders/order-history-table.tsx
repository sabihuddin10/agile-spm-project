import type { Order } from '@/types';
import { ORDER_STATUS, PAYMENT_STATUS, formatTime, money } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { placementLabel } from './labels';

/** Today's finished (closed or cancelled) orders, newest first (US3.3). */
export function OrderHistoryTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-stone-500">No closed or cancelled orders yet today.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="table-base min-w-[36rem]">
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Type / table</th>
            <th scope="col">Status</th>
            <th scope="col">Payment</th>
            <th scope="col" className="text-right">
              Total
            </th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="font-mono font-semibold">#{o.number}</td>
              <td>
                <span className="text-stone-700">{o.type === 'dine-in' ? 'Dine-in' : 'Online'}</span>
                <span className="text-stone-500">
                  {' · '}
                  {o.type === 'dine-in' ? (o.tableNumber ? `Table ${o.tableNumber}` : 'no table') : placementLabel(o)}
                </span>
              </td>
              <td>
                <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
              </td>
              <td>
                <Badge tone={PAYMENT_STATUS[o.paymentStatus].tone}>{PAYMENT_STATUS[o.paymentStatus].label}</Badge>
              </td>
              <td className="text-right font-medium">{money(o.total)}</td>
              <td className="text-stone-500">{formatTime(o.closedAt ?? o.cancelledAt ?? o.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
