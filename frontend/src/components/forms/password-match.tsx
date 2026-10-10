'use client';

import { CheckIcon, XMarkIcon } from '@/components/ui/icons';
import { TONES, type Tone } from '@/components/forms/tone';

/**
 * Live "Passwords match" / "Passwords don't match" under a confirm field.
 * Silent until something is typed in the confirm field.
 */
export function PasswordMatch({ id, password, confirm, tone = 'light' }: { id: string; password: string; confirm: string; tone?: Tone }) {
  const t = TONES[tone];
  const matches = confirm.length > 0 && confirm === password;
  return (
    <p id={id} className="mt-1 min-h-[1rem] text-xs" aria-live="polite">
      {confirm.length === 0 ? null : matches ? (
        <span className={`inline-flex items-center gap-1 ${t.met}`}>
          <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Passwords match
        </span>
      ) : (
        <span className={`inline-flex items-center gap-1 ${t.error}`}>
          <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Passwords don&apos;t match
        </span>
      )}
    </p>
  );
}
