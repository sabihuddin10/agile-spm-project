'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Order } from '@/types';
import { orderApi } from '@/lib/api';
import { errorMessage, money } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { AllergyBanner } from './allergy-banner';
import { OrderLineEditor, indexMenu, linesFromOrder, toOrderLines, unavailableLines, type DraftLine } from './order-editor';
import { placementLabel } from './labels';
import { useOrderMenu } from './use-order-menu';

/**
 * Amend a placed, unpaid order before it is confirmed (US3.2): the line editor
 * is prefilled from the order and saving replaces its items server-side.
 */
export function EditItemsModal({
  order,
  onClose,
  onSaved,
}: {
  order: Order;
  onClose: () => void;
  onSaved: (order: Order) => void;
}) {
  const toast = useToast();
  const categories = useOrderMenu();
  const byId = useMemo(() => indexMenu(categories ?? []), [categories]);
  const [lines, setLines] = useState<DraftLine[]>(() => linesFromOrder(order));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm('Discard your changes to this order?')) return;
    onClose();
  }, [dirty, onClose, saving]);

  const blocked = unavailableLines(lines, byId);

  async function save() {
    setSaving(true);
    try {
      const { order: updated } = await orderApi.replaceItems(order.id, toOrderLines(lines));
      toast(`Order #${updated.number} updated — new subtotal ${money(updated.subtotal)}.`, 'success');
      onSaved(updated);
    } catch (err) {
      toast(errorMessage(err, 'Failed to update the order.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit order #${order.number}`} onClose={requestClose} wide>
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm text-stone-500">
            {placementLabel(order)}
            {order.customer ? ` · ${order.customer.name}` : ''} · items can be changed until the order is confirmed.
          </p>
          {order.customer ? (
            <AllergyBanner
              allergies={order.customer.preferences.allergies}
              dietary={order.customer.preferences.dietary}
            />
          ) : null}
        </div>

        {categories === null ? (
          <Spinner label="Loading menu…" />
        ) : (
          <OrderLineEditor
            categories={categories}
            lines={lines}
            onChange={(next) => {
              setLines(next);
              setDirty(true);
            }}
            allergies={order.customer?.preferences.allergies}
          />
        )}

        {lines.length === 0 ? (
          <p className="text-sm text-red-600">An order needs at least one item — cancel the order instead.</p>
        ) : blocked.length > 0 ? (
          <p className="text-sm text-red-600">Remove unavailable dishes before saving.</p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-stone-200 pt-4 sm:flex-row sm:justify-end">
          <button type="button" className="btn-ghost" onClick={requestClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={saving || !dirty || lines.length === 0 || blocked.length > 0}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
