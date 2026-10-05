'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InventoryItem, MenuItem, PurchaseOrder, StockMovement } from '@/types';
import { inventoryApi, menuApi } from '@/lib/api';
import { errorMessage, money } from '@/lib/format';
import { can } from '@/lib/permissions';
import { usePolling } from '@/hooks/use-polling';
import { useAuth } from '@/context/auth-context';
import { StaffLayout } from '@/components/layout/staff-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { LowStockBanner } from '@/components/inventory/low-stock-banner';
import { StockTable } from '@/components/inventory/stock-table';
import { IngredientForm } from '@/components/inventory/ingredient-form';
import { StockAdjust } from '@/components/inventory/stock-adjust';
import { StockMovements } from '@/components/inventory/movements';
import { RecipesPanel } from '@/components/inventory/recipes-panel';
import { RecipeEditor } from '@/components/inventory/recipe-editor';
import { ReorderForm } from '@/components/inventory/reorder-form';
import { PurchaseOrders } from '@/components/inventory/purchase-orders';

type Tab = 'stock' | 'movements' | 'recipes' | 'reorder';
const TABS: Tab[] = ['stock', 'movements', 'recipes', 'reorder'];
const MOVEMENT_LIMIT = 40;

/**
 * Inventory (Sprint 8): live stock levels and adjustments (US8.1), recipes /
 * bill of materials (US8.2), the stock movement log fed by order closes
 * (US8.3), low-stock alerts (US8.4) and supplier reorders (US8.5).
 * Chefs view and adjust stock; managers/admins have full control.
 */
export default function InventoryPage() {
  const { user } = useAuth();
  const toast = useToast();
  const role = user?.role;
  const canManage = can.manageInventory(role);
  const canAdjust = can.adjustStock(role);
  const canEditRecipes = can.editRecipes(role);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [movementFilter, setMovementFilter] = useState('');

  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [dishesLoading, setDishesLoading] = useState(false);
  const dishesLoaded = useRef(false);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [reorderKey, setReorderKey] = useState(0);

  const [tab, setTab] = useState<Tab>('stock');
  const [scrollToReorder, setScrollToReorder] = useState(false);
  const [form, setForm] = useState<{ editing: InventoryItem | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [recipeDish, setRecipeDish] = useState<MenuItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /* ---------------------------------------------------------- loading */

  const loadStock = useCallback(
    async (quiet = false) => {
      try {
        const res = await inventoryApi.list();
        setItems(res.inventory);
        setUnits(res.units);
        setCategories(res.categories);
      } catch (err) {
        if (!quiet) toast(errorMessage(err, 'Failed to load inventory.'), 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const loadMovements = useCallback(
    async (inventoryId: string, quiet = false) => {
      try {
        const res = await inventoryApi.movements({ limit: MOVEMENT_LIMIT, inventoryId: inventoryId || undefined });
        setMovements(res.movements);
      } catch (err) {
        if (!quiet) toast(errorMessage(err, 'Failed to load stock movements.'), 'error');
      } finally {
        setMovementsLoading(false);
      }
    },
    [toast],
  );

  const loadDishes = useCallback(async () => {
    setDishesLoading(true);
    try {
      const res = await menuApi.items();
      setDishes(
        [...res.items].sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name)),
      );
      dishesLoaded.current = true;
    } catch (err) {
      toast(errorMessage(err, 'Failed to load recipes.'), 'error');
    } finally {
      setDishesLoading(false);
    }
  }, [toast]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await inventoryApi.purchaseOrders();
      setOrders(res.purchaseOrders);
    } catch (err) {
      toast(errorMessage(err, 'Failed to load purchase orders.'), 'error');
    } finally {
      setOrdersLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStock();
    loadMovements('');
  }, [loadStock, loadMovements]);

  // Live: stock levels and the movement log refresh every 10 s.
  usePolling(() => {
    loadStock(true);
    loadMovements(movementFilter, true);
  }, 10000);

  /* ------------------------------------------------------------- tabs */

  const allowed = useCallback((t: Tab) => t !== 'reorder' || canManage, [canManage]);

  const openTab = useCallback(
    (next: Tab) => {
      if (!allowed(next)) return;
      setTab(next);
      if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${next}`);
      if (next === 'recipes' && !dishesLoaded.current) loadDishes();
      if (next === 'reorder') loadOrders();
    },
    [allowed, loadDishes, loadOrders],
  );

  // Deep links such as /staff/inventory#reorder, once the role is known.
  const hashApplied = useRef(false);
  useEffect(() => {
    if (!role || hashApplied.current) return;
    hashApplied.current = true;
    const hash = window.location.hash.slice(1) as Tab;
    if (TABS.includes(hash) && hash !== 'stock') openTab(hash);
  }, [role, openTab]);

  useEffect(() => {
    if (!scrollToReorder || tab !== 'reorder') return;
    document.getElementById('reorder-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setScrollToReorder(false);
  }, [scrollToReorder, tab]);

  /* ---------------------------------------------------------- derived */

  const low = useMemo(() => items.filter((i) => i.health === 'low'), [items]);
  const nearCount = items.filter((i) => i.health === 'near').length;
  const stockValue = items.reduce((s, i) => s + i.stock * i.costPerUnit, 0);
  const suppliers = useMemo(() => Array.from(new Set(items.map((i) => i.supplier).filter(Boolean))).sort(), [items]);
  const openOrders = orders.filter((o) => o.status === 'sent').length;

  /* ---------------------------------------------------------- actions */

  async function submitIngredient(data: Partial<InventoryItem>) {
    if (!canManage || !form) return;
    setSaving(true);
    try {
      if (form.editing) {
        await inventoryApi.update(form.editing.id, data);
        toast(`${data.name ?? form.editing.name} updated.`, 'success');
      } else {
        await inventoryApi.create(data);
        toast(`${data.name} added to inventory.`, 'success');
      }
      setForm(null);
      await Promise.all([loadStock(), loadMovements(movementFilter, true)]);
    } catch (err) {
      toast(errorMessage(err, 'Failed to save ingredient.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeIngredient(item: InventoryItem) {
    if (!canManage) return;
    if (!window.confirm(`Delete ${item.name} from inventory? This cannot be undone.`)) return;
    setBusyId(item.id);
    try {
      await inventoryApi.remove(item.id);
      toast(`${item.name} deleted.`, 'success');
      await loadStock();
    } catch (err) {
      // 409 explains which recipes still use it.
      toast(errorMessage(err, 'Failed to delete ingredient.'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  function showHistory(item: InventoryItem) {
    setMovementFilter(item.id);
    setMovementsLoading(true);
    loadMovements(item.id);
    openTab('movements');
  }

  /* ----------------------------------------------------------- render */

  const tabs: { id: Tab; label: string; badge?: number; tone?: string }[] = [
    { id: 'stock', label: 'Stock', badge: items.length },
    { id: 'movements', label: 'Movements' },
    { id: 'recipes', label: 'Recipes' },
    ...(canManage
      ? [{ id: 'reorder' as const, label: 'Reorder & POs', badge: low.length || undefined, tone: 'bg-red-600 text-white' }]
      : []),
  ];

  return (
    <StaffLayout section="inventory">
      <PageHeader
        title="Inventory"
        subtitle="Sprint 8 · Stock levels, recipes, automatic deduction on sale, low-stock alerts and supplier reorders. (US8.1–US8.5)"
        action={
          canManage ? (
            <button className="btn-primary" onClick={() => setForm({ editing: null })} disabled={loading}>
              + Add ingredient
            </button>
          ) : undefined
        }
      />

      {!loading ? (
        <LowStockBanner
          items={low}
          nearCount={nearCount}
          canReorder={canManage}
          onOpenReorder={() => {
            openTab('reorder');
            setScrollToReorder(true);
          }}
        />
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ingredients" value={String(items.length)} />
        <Stat label="Low stock" value={String(low.length)} tone={low.length ? 'text-red-600' : undefined} />
        <Stat label="Near reorder" value={String(nearCount)} tone={nearCount ? 'text-amber-600' : undefined} />
        <Stat label="Stock value" value={money(stockValue)} />
      </div>

      <div role="tablist" aria-label="Inventory sections" className="mb-4 flex gap-1 overflow-x-auto border-b border-stone-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => openTab(t.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
            }`}
          >
            {t.label}
            {t.badge !== undefined ? (
              <span className={`rounded-full px-1.5 text-[11px] font-semibold ${t.tone ?? 'bg-stone-100 text-stone-500'}`}>
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'stock' ? (
          <Card className="p-0">
            {loading ? (
              <Spinner label="Loading inventory…" />
            ) : (
              <StockTable
                items={items}
                canAdjust={canAdjust}
                canManage={canManage}
                busyId={busyId}
                onAdjust={setAdjusting}
                onEdit={(item) => setForm({ editing: item })}
                onDelete={removeIngredient}
                onHistory={showHistory}
              />
            )}
          </Card>
        ) : null}

        {tab === 'movements' ? (
          <Card className="p-0">
            <StockMovements
              movements={movements}
              inventory={items}
              inventoryId={movementFilter}
              loading={movementsLoading}
              onFilterChange={(id) => {
                setMovementFilter(id);
                loadMovements(id);
              }}
            />
          </Card>
        ) : null}

        {tab === 'recipes' ? (
          <Card className="p-0">
            <RecipesPanel
              items={dishes}
              inventory={items}
              canEdit={canEditRecipes}
              loading={dishesLoading}
              onEdit={setRecipeDish}
            />
          </Card>
        ) : null}

        {tab === 'reorder' && canManage ? (
          <div className="space-y-4">
            <ReorderForm inventory={items} reloadKey={reorderKey} onSubmitted={() => loadOrders()} />
            <Card className="p-0">
              <PurchaseOrders
                orders={orders}
                loading={ordersLoading}
                onReceived={() => {
                  loadOrders();
                  loadStock();
                  loadMovements(movementFilter, true);
                  setReorderKey((k) => k + 1);
                }}
              />
            </Card>
            {openOrders > 0 ? (
              <p className="no-print text-xs text-stone-400">
                Mark a purchase order received when the delivery arrives — each line is added to stock and logged as a
                restock movement.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {form ? (
        <Modal title={form.editing ? `Edit ${form.editing.name}` : 'Add ingredient'} onClose={() => setForm(null)} wide>
          <IngredientForm
            initial={form.editing}
            units={units}
            categories={categories}
            suppliers={suppliers}
            onSubmit={submitIngredient}
            onCancel={() => setForm(null)}
            submitting={saving}
          />
        </Modal>
      ) : null}

      {adjusting ? (
        <StockAdjust
          item={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            loadStock();
            loadMovements(movementFilter, true);
          }}
        />
      ) : null}

      {recipeDish ? (
        <RecipeEditor
          item={recipeDish}
          inventory={items}
          onClose={() => setRecipeDish(null)}
          onSaved={(updated) => {
            setRecipeDish(null);
            setDishes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
            loadStock(true);
          }}
        />
      ) : null}
    </StaffLayout>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${tone ?? 'text-stone-900'}`}>{value}</p>
    </div>
  );
}
