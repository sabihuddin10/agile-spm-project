'use client';

import { CheckIcon, XMarkIcon } from '@/components/ui/icons';
import { checkPassword, passwordStrength, type PasswordContext, type PasswordStrength } from '@/lib/validation/password';
import { TONES, type Tone } from '@/components/forms/tone';

const STRENGTH_LABEL: Record<Exclude<PasswordStrength, 'empty'>, string> = { weak: 'Weak', fair: 'Fair', strong: 'Strong' };
const STRENGTH_STEPS: Record<PasswordStrength, number> = { empty: 0, weak: 1, fair: 2, strong: 3 };

/**
 * Live password checklist. Each rule shows a check when met and a neutral dot
 * while it is not (red only once the form has been submitted, `showUnmet`).
 * A polite live region announces "3 of 5 requirements met" for screen readers,
 * and a three-step strength meter shows the strength as text and as a bar.
 */
export function PasswordRequirements({
  id,
  value,
  email,
  name,
  tone = 'light',
  showUnmet = false,
}: {
  id?: string;
  value: string;
  tone?: Tone;
  /** Set after a submit attempt: unmet rules turn red. */
  showUnmet?: boolean;
} & PasswordContext) {
  const t = TONES[tone];
  const check = checkPassword(value, { email, name });
  const strength = passwordStrength(value, { email, name });
  const steps = STRENGTH_STEPS[strength];
  const barColour = strength === 'strong' ? t.strong : strength === 'fair' ? t.fair : t.weak;

  return (
    <div id={id} className="mt-2 text-xs">
      <ul className="grid gap-1 sm:grid-cols-2" aria-label="Password requirements">
        {check.rules.map((rule) => {
          const colour = rule.met ? t.met : showUnmet ? t.error : t.pending;
          return (
            <li key={rule.id} className={`flex items-center gap-1.5 ${colour}`}>
              {rule.met ? (
                <CheckIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : showUnmet ? (
                <XMarkIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                </span>
              )}
              <span>
                {rule.label}
                <span className="sr-only">{rule.met ? ' (met)' : ' (not met yet)'}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {check.extra.map((message) => (
        <p key={message} className={`mt-1.5 ${t.error}`}>
          {message}
        </p>
      ))}

      <div className="mt-2 flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3].map((step) => (
            <span key={step} className={`h-1 flex-1 rounded-full ${step <= steps ? barColour : t.track}`} />
          ))}
        </div>
        <span className={`w-24 shrink-0 text-right ${t.hint}`}>
          {strength === 'empty' ? 'Strength: –' : `Strength: ${STRENGTH_LABEL[strength]}`}
        </span>
      </div>

      <p className="sr-only" aria-live="polite" role="status">
        {`${check.metCount} of ${check.rules.length} requirements met`}
        {strength !== 'empty' ? `. Strength: ${STRENGTH_LABEL[strength]}.` : ''}
      </p>
    </div>
  );
}
