import { TONES, type Tone } from '@/components/forms/tone';

/** Error text under a field; pair it with aria-invalid and aria-describedby={id} on the input. */
export function FieldError({ id, message, tone = 'light' }: { id: string; message?: string; tone?: Tone }) {
  if (!message) return null;
  return (
    <p id={id} className={`mt-1 text-xs ${TONES[tone].error}`}>
      {message}
    </p>
  );
}

/** Join the ids of the hint/error elements that describe a field (skipping empty ones). */
export function describedBy(...ids: (string | false | null | undefined)[]): string | undefined {
  const list = ids.filter(Boolean);
  return list.length ? list.join(' ') : undefined;
}

/**
 * Says why the submit button is disabled: "Complete these fields to continue:
 * Name, Email." Point the button's aria-describedby at `id`. Renders nothing
 * once every field is valid.
 */
export function SubmitHint({ id, fields, tone = 'light', className = '' }: { id: string; fields: string[]; tone?: Tone; className?: string }) {
  if (!fields.length) return null;
  return (
    <p id={id} className={`text-xs ${TONES[tone].hint} ${className}`}>
      Complete these fields to continue: {fields.join(', ')}.
    </p>
  );
}
