'use client';

import { useCallback, useState } from 'react';

export type Rules<V> = { [K in keyof V]?: (value: V[K], values: V) => string | undefined };
export type Errors<V> = Partial<Record<keyof V, string>>;

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
 * Field validation that stays quiet until a field has been left once (blur),
 * then re-checks live on every change. Submitting touches every field.
 *
 *   const v = useFormValidation(form, rules);
 *   <input onBlur={() => v.blur('email')} aria-invalid={Boolean(v.errors.email)} … />
 *   if (!v.touchAll()) return;   // on submit
 */
export function useFormValidation<V extends object>(values: V, rules: Rules<V>) {
  const [touched, setTouched] = useState<Partial<Record<keyof V, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const all = collectErrors(values, rules);
  const errors: Errors<V> = {};
  for (const key of Object.keys(all) as (keyof V)[]) {
    if (submitted || touched[key]) errors[key] = all[key];
  }

  const blur = useCallback((key: keyof V) => setTouched((t) => (t[key] ? t : { ...t, [key]: true })), []);

  /** Mark the form as submitted (shows every error); returns true when it is valid. */
  const touchAll = () => {
    setSubmitted(true);
    return Object.keys(all).length === 0;
  };

  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
  }, []);

  return { errors, allErrors: all, isValid: Object.keys(all).length === 0, submitted, blur, touchAll, reset };
}
