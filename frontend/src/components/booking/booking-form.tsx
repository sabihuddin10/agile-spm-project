'use client';

import { useState } from 'react';
import { reservationApi } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/card';

export function BookingForm() {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({
    customerName: user ? user.name : '',
    email: user ? user.email : '',
    phone: '',
    partySize: 2,
    date: '',
    time: '19:00',
    specialRequests: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { id: string; status: string }>(null);

  function set<K extends keyof typeof form>(key: K, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { reservation } = await reservationApi.create(form);
      setDone({ id: reservation.id, status: reservation.status });
      toast('Booking requested — we will confirm shortly.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Booking failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="max-w-md p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ember/15 text-ember-soft">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display mt-3 text-xl font-semibold tracking-tight text-bone">
          Booking requested
        </h2>
        <p className="mt-1 text-sm text-bone-dim">
          Ref <span className="font-mono">{done.id}</span>, status{' '}
          <span className="capitalize">{done.status}</span>. We&apos;ll confirm by phone or email.
        </p>
        <button className="btn-secondary mt-4" onClick={() => setDone(null)}>
          Make another booking
        </button>
      </Card>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="w-full max-w-md p-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-bone">
        Book a table
      </h1>
      <p className="mt-1 text-sm text-bone-dim">
        {user ? `Booking as ${user.name}.` : 'Fill in your details, no account needed.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" required value={form.customerName} onChange={(e) => set('customerName', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(optional)" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Party size</label>
            <input className="input" type="number" min={1} max={12} required value={form.partySize} onChange={(e) => set('partySize', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Time</label>
            <select className="input" value={form.time} onChange={(e) => set('time', e.target.value)}>
              {['12:00', '12:30', '13:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" required min={today} value={form.date} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div>
          <label className="label">Special requests</label>
          <textarea className="input min-h-[60px]" value={form.specialRequests} onChange={(e) => set('specialRequests', e.target.value)} placeholder="Birthdays, window seat, allergies…" />
        </div>
        <button className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Requesting…' : 'Request booking'}
        </button>
      </form>
    </Card>
  );
}