'use client';

import { useState } from 'react';
import Link from 'next/link';
import { staffApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

type DesiredRole = 'waiter' | 'chef';

const ROLES: { id: DesiredRole; title: string; blurb: string }[] = [
  { id: 'waiter', title: 'Waiter', blurb: 'Front of house — run the floor, take orders, look after guests.' },
  { id: 'chef', title: 'Chef', blurb: 'Kitchen — work the wood-fired line and the pass.' },
];

const EXPERIENCE_MAX = 1000;
const EMPTY = { name: '', email: '', phone: '', desiredRole: 'waiter' as DesiredRole, experience: '' };

/**
 * Public "join our team" application form (US9.1). Submissions land in the
 * managers' review queue; server errors (e.g. a duplicate pending application)
 * are shown inline.
 */
export function CareersForm() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ name: string; role: DesiredRole } | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { application } = await staffApi.apply({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        desiredRole: form.desiredRole,
        experience: form.experience.trim() || undefined,
      });
      setSubmitted({ name: application.name, role: application.desiredRole });
      setForm(EMPTY);
      toast('Application sent — thank you!', 'success');
    } catch (err) {
      const message = errorMessage(err, 'Could not send your application. Please try again.');
      setError(message);
      toast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="p-6 text-center sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ember/15 text-ember-soft">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-bone">
          Thanks, {submitted.name.split(' ')[0]}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-bone-dim" role="status">
          Thanks — a manager will review your application to join as a {submitted.role} and get back to you by email.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/" className="btn-primary">
            Back to home
          </Link>
          <button type="button" className="btn-secondary" onClick={() => setSubmitted(null)}>
            Submit another application
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-bone">Apply now</h2>
      <p className="mt-1 text-sm text-bone-dim">It takes two minutes. No CV needed.</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <fieldset className="min-w-0">
          <legend className="label">I&apos;m applying as</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ROLES.map((r) => {
              const selected = form.desiredRole === r.id;
              return (
                <label
                  key={r.id}
                  className={`cursor-pointer rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-ember ${
                    selected ? 'border-ember bg-ember/10' : 'border-char-hairline bg-char-deep hover:border-ember/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="desiredRole"
                    value={r.id}
                    checked={selected}
                    onChange={() => set('desiredRole', r.id)}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                        selected ? 'border-ember' : 'border-bone-faint'
                      }`}
                      aria-hidden="true"
                    >
                      {selected ? <span className="h-2 w-2 rounded-full bg-ember" /> : null}
                    </span>
                    <span className="font-semibold text-bone">{r.title}</span>
                  </span>
                  <span className="mt-1 block text-xs text-bone-dim">{r.blurb}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label className="label" htmlFor="apply-name">
            Full name
          </label>
          <input
            id="apply-name"
            className="input"
            required
            autoComplete="name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="apply-email">
              Email
            </label>
            <input
              id="apply-email"
              className="input"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="apply-phone">
              Phone <span className="font-normal text-bone-faint">(optional)</span>
            </label>
            <input
              id="apply-phone"
              className="input"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="apply-experience">
            Experience
          </label>
          <textarea
            id="apply-experience"
            className="input min-h-[120px]"
            maxLength={EXPERIENCE_MAX}
            placeholder="Where have you worked? What do you enjoy? Availability (days, evenings, weekends)…"
            value={form.experience}
            onChange={(e) => set('experience', e.target.value)}
            aria-describedby="apply-experience-count"
          />
          <p id="apply-experience-count" className="mt-1 text-right text-xs text-bone-faint">
            {form.experience.length}/{EXPERIENCE_MAX}
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-ember-glow" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send application'}
        </button>
        <p className="text-center text-xs text-bone-faint">
          We only use your details to review this application.
        </p>
      </form>
    </Card>
  );
}
