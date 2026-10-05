'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Customer } from '@/types';
import { customerApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { StaffLayout } from '@/components/layout/staff-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  CustomerTable,
  CustomerFilters,
  EMPTY_FILTERS,
  type CustomerFilterValues,
} from '@/components/customers/customer-table';
import { CustomerForm } from '@/components/customers/customer-form';
import { CustomerDetail } from '@/components/customers/customer-detail';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Customer ledger (US1.1–US1.5): add/edit/delete customers, search and filter
 * (re-queried on every change, search debounced), order history and preferences.
 */
export default function CustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CustomerFilterValues>(EMPTY_FILTERS);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const requestId = useRef(0);
  const detailRef = useRef<HTMLDivElement>(null);

  // Debounce only the free-text search; dropdown filters apply immediately.
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(filters.q.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [filters.q]);

  const { type, dietary, allergy } = filters;

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const { customers: list } = await customerApi.list({ q: query, type, dietary, allergy });
      if (id !== requestId.current) return; // a newer query superseded this one
      setCustomers(list);
      setSelected((prev) => (prev ? list.find((c) => c.id === prev.id) ?? prev : null));
    } catch (err) {
      if (id === requestId.current) toast(errorMessage(err, 'Failed to load customers.'), 'error');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [query, type, dietary, allergy, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function select(customer: Customer) {
    setSelected(customer);
    // Below xl the detail sits under the table — bring it into view.
    if (window.innerWidth < 1280) {
      window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit() {
    setEditing(selected);
    setFormError(null);
    setFormOpen(true);
  }

  async function submit(data: Partial<Customer>) {
    setSaving(true);
    setFormError(null);
    try {
      const { customer } = editing ? await customerApi.update(editing.id, data) : await customerApi.create(data);
      toast(editing ? 'Customer updated.' : 'Customer added.', 'success');
      setFormOpen(false);
      setSelected(customer);
      await load();
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to save customer.'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected) return;
    if (!window.confirm(`Delete ${selected.name}? Their past orders are kept, but the profile cannot be restored.`)) return;
    setDeleting(true);
    try {
      await customerApi.remove(selected.id);
      toast('Customer deleted.', 'success');
      setSelected(null);
      await load();
    } catch (err) {
      toast(errorMessage(err, 'Failed to delete customer.'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  const searching = loading && customers !== null;

  return (
    <StaffLayout section="customers">
      <PageHeader
        title="Customers"
        subtitle="Customer ledger — search, preferences and allergies, loyalty points and order history."
        action={
          <button type="button" onClick={openCreate} className="btn-primary">
            + Add customer
          </button>
        }
      />

      <Card className="mb-4">
        <CustomerFilters value={filters} onChange={setFilters} busy={searching} />
      </Card>

      <div className={`grid items-start gap-4 ${selected && !formOpen ? 'xl:grid-cols-[minmax(0,1fr)_420px]' : ''}`}>
        {customers === null ? (
          <Card>
            <Spinner label="Loading customer ledger…" />
          </Card>
        ) : customers.length === 0 ? (
          <Card>
            <EmptyState
              title="No customers match"
              hint="Try clearing the filters, or add a new customer."
              action={
                <button type="button" onClick={openCreate} className="btn-secondary">
                  + Add customer
                </button>
              }
            />
          </Card>
        ) : (
          <Card className={`p-0 transition-opacity ${searching ? 'opacity-60' : ''}`}>
            <p className="border-b border-stone-100 px-4 py-2.5 text-xs text-stone-500">
              {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
            </p>
            <CustomerTable customers={customers} onSelect={select} selectedId={selected?.id ?? null} />
          </Card>
        )}

        {selected && !formOpen ? (
          <div ref={detailRef} className="scroll-mt-20 xl:sticky xl:top-4">
            <Card>
              <CustomerDetail
                customer={selected}
                onEdit={openEdit}
                onDelete={remove}
                onClose={() => setSelected(null)}
                deleting={deleting}
              />
            </Card>
          </div>
        ) : null}
      </div>

      {formOpen ? (
        <Modal title={editing ? `Edit ${editing.name}` : 'Add customer'} onClose={() => setFormOpen(false)} wide>
          <CustomerForm
            initial={editing}
            onSubmit={submit}
            onCancel={() => setFormOpen(false)}
            submitting={saving}
            error={formError}
          />
        </Modal>
      ) : null}
    </StaffLayout>
  );
}
