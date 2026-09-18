'use client';

import { useCallback, useEffect, useState } from 'react';
import { StaffLayout } from '@/components/layout/staff-layout';
import { inventoryApi } from '@/lib/api';
import type { InventoryItem } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';

export default function InventoryPage() {
  const toast = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLow, setShowLow] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await inventoryApi.list();
      setItems(res.inventory);
      setUnits(res.units);
    } catch {
      toast('Failed to load inventory.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function adjust(item: InventoryItem, delta: number) {
    try {
      await inventoryApi.update(item.id, { delta });
      toast(`${delta > 0 ? 'Added' : 'Removed'} stock for ${item.name}.`, 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  }

  const displayed = showLow ? items.filter((i) => i.lowStock) : items;
  const lowCount = items.filter((i) => i.lowStock).length;

  return (
    <StaffLayout>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <Badge tone="blue">Sprint 8 · Live</Badge>
        <label className="ml-auto flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={showLow}
            onChange={(e) => setShowLow(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300"
          />
          Low stock only ({lowCount})
        </label>
      </div>

      {loading ? (
        <Spinner label="Loading inventory…" />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Reorder at</th>
                <th>Cost / unit</th>
                <th className="text-right">Adjust</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((item) => (
                <tr key={item.id} className={item.lowStock ? 'bg-red-50/50' : ''}>
                  <td className="font-medium">{item.name}</td>
                  <td className="text-stone-500">{item.category}</td>
                  <td>
                    <span className="font-semibold">
                      {item.stock} {item.unit}
                    </span>{' '}
                    {item.lowStock ? <Badge tone="red">Reorder</Badge> : null}
                  </td>
                  <td className="text-stone-500">
                    {item.reorderLevel} {item.unit}
                  </td>
                  <td className="text-stone-500">${item.costPerUnit.toFixed(2)}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => adjust(item, -10)}>
                        −10
                      </button>
                      <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => adjust(item, 10)}>
                        +10
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StaffLayout>
  );
}