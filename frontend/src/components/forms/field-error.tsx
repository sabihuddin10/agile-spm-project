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
