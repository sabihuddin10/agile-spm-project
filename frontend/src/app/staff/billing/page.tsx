'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Bill, BillingSummary } from '@/types';
import { billingApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { usePolling } from '@/hooks/use-polling';
import { StaffLayout } from '@/components/layout/staff-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { BillSummary } from '@/components/billing/bill-summary';
import { BillList } from '@/components/billing/bill-list';
import { BillPanel } from '@/components/billing/bill-panel';
import { isReadyToBill } from '@/components/billing/bill-utils';

type Scope = 'open' | 'today' | 'all';

const TABS: { scope: Scope; label: string; hint: string; empty: { title: string; hint: string } }[] = [
  {
    scope: 'open',
    label: 'Open',
    hint: 'Unpaid bills — ready-to-bill tables first.',
    empty: {
      title: 'No open bills',
      hint: 'Every bill is settled. Served dine-in orders and unpaid online orders show up here automatically.',
    },
  },
  {
    scope: 'today',
    label: 'Today',
    hint: 'Unpaid bills plus everything paid today.',
    empty: { title: 'No bills today', hint: 'Open bills and bills paid today will appear here.' },
  },
  {
    scope: 'all',
    label: 'All',
    hint: 'Every bill, newest first. Cancelled orders are not billable.',
    empty: { title: 'No bills yet', hint: 'A bill appears as soon as an order is placed.' },
  },
];

/** Desktop shows the bill beside the list; smaller screens open it in a modal. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/**
 * Billing desk (US5.1–US5.5): live open/today/all bills with outstanding and
 * paid-today totals; each bill opens an itemized view for tips, splits,
 * payment, receipts and refunds.
 */
export default function BillingPage() {
  const toast = useToast();
  const [scope, setScope] = useState<Scope>('open');
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const desktop = useMediaQuery('(min-width: 1280px)');
  // Bumped per request so a slow response for an old tab can't replace the current one.
  const seq = useRef(0);

  const load = useCallback(
    async (background = false) => {
      const mine = ++seq.current;
      try {
        const res = await billingApi.list(scope);
        if (mine !== seq.current) return;
        setBills(res.bills);
        setSummary(res.summary);
        setFailed(false);
      } catch (err) {
        if (mine !== seq.current || background) return;
        setFailed(true);
        toast(errorMessage(err, 'Failed to load bills.'), 'error');
      }
    },
    [scope, toast],
  );

  useEffect(() => {
    setBills(null);
    load();
  }, [load]);
  usePolling(() => load(true), 5000);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);
  const closePanel = useCallback(() => setSelectedId(null), []);

  const rows = useMemo(() => {
    if (!bills) return [];
    if (scope !== 'open') return bills;
    // Served tables waiting to pay first; otherwise keep the server's newest-first order.
    return [...bills].sort((a, b) => Number(isReadyToBill(b)) - Number(isReadyToBill(a)));
  }, [bills, scope]);
  const readyCount = useMemo(() => (bills ?? []).filter(isReadyToBill).length, [bills]);
  const selected = bills?.find((b) => b.id === selectedId) ?? null;
  const tab = TABS.find((t) => t.scope === scope) ?? TABS[0];

  const panel = selectedId ? (
    <BillPanel
      key={selectedId}
      billId={selectedId}
      initial={selected}
      onChanged={refresh}
      onClose={closePanel}
      onDialogChange={setDialogOpen}
      showHeaderClose={desktop}
    />
  ) : null;

  return (
    <StaffLayout section="billing">
      <PageHeader
        title="Billing"
        subtitle="Itemized bills, tips, split payments, receipts and refunds. (US5.1–US5.5)"
        action={
          <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
            Live · updates every 5 s
          </span>
        }
      />

      <BillSummary summary={summary} readyCount={readyCount} />

      <div className={desktop && selectedId ? 'grid grid-cols-[minmax(0,1fr)_440px] items-start gap-6' : ''}>
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
            <div className="inline-flex rounded-lg bg-stone-100 p-1" role="tablist" aria-label="Bill scope">
              {TABS.map((t) => (
                <button
                  key={t.scope}
                  type="button"
                  role="tab"
                  aria-selected={scope === t.scope}
                  onClick={() => setScope(t.scope)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    scope === t.scope ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {t.label}
                  {t.scope === 'open' && summary ? (
                    <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700">
                      {summary.openCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <p className="text-xs text-stone-500">{tab.hint}</p>
          </div>

          {bills === null ? (
            failed ? (
              <EmptyState
                title="Couldn't load bills"
                hint="Check your connection and try again."
                action={
                  <button type="button" className="btn-secondary" onClick={() => load()}>
                    Retry
                  </button>
                }
              />
            ) : (
              <Spinner label="Loading bills…" />
            )
          ) : rows.length === 0 ? (
            <EmptyState title={tab.empty.title} hint={tab.empty.hint} />
          ) : (
            <BillList bills={rows} selectedId={selectedId} onSelect={(b) => setSelectedId(b.id)} />
          )}
        </Card>

        {desktop && panel ? (
          <aside
            className="card sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto print:static print:max-h-none print:overflow-visible"
            aria-label="Bill details"
          >
            {panel}
          </aside>
        ) : null}
      </div>

      {!desktop && panel ? (
        <Modal
          title="Bill details"
          onClose={() => {
            // Escape also reaches this modal while a split/refund dialog is on top; let that one close first.
            if (!dialogOpen) closePanel();
          }}
        >
          {panel}
        </Modal>
      ) : null}
    </StaffLayout>
  );
}
