'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { customerApi } from '@/lib/api';
import type { Customer } from '@/types';
import { Spinner } from '@/components/ui/spinner';
import { Card } from '@/components/ui/card';

export function ProfileEditor() {
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    customerApi
      .me()
      .then((res) => {
        if (cancelled) return;
        setCustomer(res.customer);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || user.role !== 'customer') return null;

  if (loading) {
    return (
      <Card>
        <Spinner label="Loading your profile…" />
      </Card>
    );
  }

  if (!customer) {
    return (
      <Card>
        <p className="text-sm text-bone-dim">No customer profile is linked to your account yet.</p>
      </Card>
    );
  }

  function update(field: keyof Pick<Customer, 'name' | 'email' | 'phone' | 'notes'>, value: string) {
    setCustomer((c) => (c ? { ...c, [field]: value } : c));
  }

  function updatePref(key: 'dietary' | 'allergies', raw: string) {
    const arr = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    setCustomer((c) => (c ? { ...c, preferences: { ...c.preferences, [key]: arr } } : c));
  }

  async function handleSave() {
    if (!customer) return;
    setSaving(true);
    setMsg(null);
    try {
      const { customer: updated } = await customerApi.updateMe({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        notes: customer.notes,
        preferences: customer.preferences,
      });
      setCustomer(updated);
      setMsg({ tone: 'ok', text: 'Profile saved.' });
    } catch (err) {
      setMsg({ tone: 'err', text: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold tracking-tight text-bone">
          Your profile
        </h3>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name" value={customer.name} onChange={(v) => update('name', v)} />
        <Field label="Email" value={customer.email} onChange={(v) => update('email', v)} type="email" />
        <Field label="Phone" value={customer.phone} onChange={(v) => update('phone', v)} />
        <Field
          label="Dietary (comma-separated)"
          value={customer.preferences.dietary.join(', ')}
          onChange={(v) => updatePref('dietary', v)}
        />
        <div className="sm:col-span-2">
          <Field
            label="Allergies (comma-separated)"
            value={customer.preferences.allergies.join(', ')}
            onChange={(v) => updatePref('allergies', v)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[64px] resize-y"
            value={customer.notes}
            onChange={(e) => update('notes', e.target.value)}
          />
        </div>
      </div>

      {msg ? (
        <p className={`mt-3 text-sm ${msg.tone === 'ok' ? 'text-ember-soft' : 'text-red-400'}`}>
          {msg.text}
        </p>
      ) : null}

      <button className="btn-primary mt-5" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}