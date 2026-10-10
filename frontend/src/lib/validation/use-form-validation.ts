'use client';

import { useCallback, useState } from 'react';

export type Rules<V> = { [K in keyof V]?: (value: V[K], values: V) => string | undefined };
export type Errors<V> = Partial<Record<keyof V, string>>;
export type Labels<V> = Partial<Record<keyof V, string>>;
type Flags<V> = Partial<Record<keyof V, boolean>>;

/** Every current error for `values` under `rules` (pure; exported for tests). */
export function collectErrors<V extends object>(values: V, rules: Rules<V>): Errors<V> {
  const out: Errors<V> = {};
  for (const key of Object.keys(rules) as (keyof V)[]) {
    const message = rules[key]?.(values[key], values);
    if (message) out[key] = message;
  }
  return out;
}

/**
 * Formik-style field validation. Every rule re-runs on every render (so on every
 * keystroke). A field's error is shown once the field is dirty (its value has
 * changed since the form was loaded or last reset) or touched (left once) —
 * a pristine, untouched form shows nothing. Submitting touches every field.
 *
 *   const v = useFormValidation(form, rules, { labels });
 *   <input onBlur={() => v.blur('email')} aria-invalid={Boolean(v.errors.email)} … />
 *   <button type="submit" disabled={!v.isValid}>…</button>
 *   <SubmitHint id="…" fields={v.invalidLabels} />
 *   if (!v.touchAll()) return;   // on submit — also guards Enter / programmatic submits
 */
export function useFormValidation<V extends object>(values: V, rules: Rules<V>, { labels }: { labels?: Labels<V> } = {}) {
  const [touched, setTouched] = useState<Flags<V>>({});
  const [dirty, setDirty] = useState<Flags<V>>({});
  const [initial, setInitial] = useState<V>(values);
  const [resetPending, setResetPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const keys = Object.keys(rules) as (keyof V)[];

  // State updates during render are React's pattern for state derived from props:
  // React re-renders straight away, before anything is committed.
  if (resetPending) {
    setResetPending(false);
    setInitial(values);
    setDirty({});
  }
  const newlyDirty = resetPending ? [] : keys.filter((k) => !dirty[k] && !Object.is(values[k], initial[k]));
  if (newlyDirty.length) {
    setDirty((d) => {
      const next = { ...d };
      for (const k of newlyDirty) next[k] = true;
      return next;
    });
  }

  const all = collectErrors(values, rules);
  const errors: Errors<V> = {};
  for (const key of Object.keys(all) as (keyof V)[]) {
    if (submitted || touched[key] || dirty[key] || newlyDirty.includes(key)) errors[key] = all[key];
  }
  const invalidKeys = keys.filter((k) => all[k]);
  const isValid = invalidKeys.length === 0;

  const blur = useCallback((key: keyof V) => setTouched((t) => (t[key] ? t : { ...t, [key]: true })), []);

  /** Mark the form as submitted (shows every error); returns true when it is valid. */
  const touchAll = () => {
    setSubmitted(true);
    return isValid;
  };

  /** True once the field has been left (or the form submitted) — e.g. to turn unmet password rules red. */
  const isTouched = (key: keyof V) => submitted || Boolean(touched[key]);

  /** Back to pristine: the values at the next render become the new baseline. */
  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
    setResetPending(true);
  }, []);

  return {
    errors,
    allErrors: all,
    isValid,
    /** True once any field has changed since load / the last reset. */
    dirty: newlyDirty.length > 0 || keys.some((k) => dirty[k]),
    /** Labels (from `labels`, else the key) of every field that still fails, in rule order. */
    invalidLabels: invalidKeys.map((k) => labels?.[k] ?? String(k)),
    submitted,
    isTouched,
    blur,
    touchAll,
    reset,
  };
}
