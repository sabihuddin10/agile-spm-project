'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Customer } from '@/types';
import { customerApi } from '@/lib/api';
import { StaffLayout } from '@/components/layout/staff-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { CustomerTable, CustomerFilters } from '@/components/customers/customer-table';
import { CustomerForm } from '@/components/customers/customer-form';
import { CustomerDetail } from '@/components/customers/customer-detail';

export default function CustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ q: string; type: string; allergen: string }>({
    q: '',
    type: '',
    allergen: '',
  });
  const [selected, setSelected] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (next?: typeof filters) => {
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        const f = next ?? filters;
        if (f.q) params.q = f.q;
        if (f.type) params.type = f.type;
        if (f.allergen) params.allergy = f.allergen;
        const { customers: list } = await customerApi.list(params);
        setCustomers(list);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to load customers.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [filters, toast],
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit() {
    setEditing(selected);
    setFormOpen(true);
  }

  async function submit(data: Partial<Customer>) {
    setSaving(true);
    try {
      if (editing) {
        const { customer } = await customerApi.update(editing.id, data);
        toast('Customer updated.', 'success');
        setFormOpen(false);
        setSelected(customer);
      } else {
        const { customer } = await customerApi.create(data);
        toast('Customer added.', 'success');
        setFormOpen(false);
        setSelected(customer);
      }
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save customer.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected) return;
    if (!window.confirm(`Delete ${selected.name}? This cannot be undone.`)) return;
    try {
      await customerApi.remove(selected.id);
      toast('Customer deleted.', 'success');
      setSelected(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete customer.', 'error');
    }
  }

  return (
    <StaffLayout>
      <PageHeader
        title="Customer management"
        subtitle="Sprint 1 · Customer ledger, search/filter, order history, and preferences. (US1.1–US1.5)"
        action={
          <button onClick={openCreate} className="btn-primary">
            + Add customer
          </button>
        }
      />

      <Card className="mb-4">
        <CustomerFilters onFilter={setFilters} />
      </Card>

      {loading ? (
        <Card>
          <Spinner label="Loading customer ledger…" />
        </Card>
      ) : customers.length === 0 ? (
        <Card>
          <EmptyState
            title="No customers match"
            hint="Try clearing filters, or add a new customer."
            action={
              <button onClick={openCreate} className="btn-secondary">
                + Add customer
              </button>
            }
          />
        </Card>
      ) : (
        <Card className="p-0">
          <CustomerTable
            customers={customers}
            onSelect={setSelected}
            selectedId={selected?.id ?? null}
          />
        </Card>
      )}

      {selected && !formOpen ? (
        <Card className="mt-4">
          <CustomerDetail customer={selected} onEdit={openEdit} onDelete={remove} />
        </Card>
      ) : null}

      {formOpen ? (
        <Modal title={editing ? `Edit ${editing.name}` : 'Add customer'} onClose={() => setFormOpen(false)} wide>
          <CustomerForm
            initial={editing}
            onSubmit={submit}
            onCancel={() => setFormOpen(false)}
            submitting={saving}
          />
        </Modal>
      ) : null}
    </StaffLayout>
  );
}