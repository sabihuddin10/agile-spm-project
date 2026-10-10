import { isValidEmail as isValidEmailAddress } from '@/lib/validation/fields';

/** Kept for existing callers; the rule itself lives in lib/validation/fields. */
export function isValidEmail(value: string): boolean {
  return isValidEmailAddress(value);
}

/**
 * Labelled text input for the staff account forms. An error replaces the hint
 * and both are tied to the input with aria-describedby.
 */
export function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  autoComplete,
  error,
  hint,
  optional = false,
  disabled = false,
  maxLength,
  placeholder,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called when the field loses focus (used to start live validation). */
  onBlur?: () => void;
  type?: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  const note = error ?? hint;
  const noteId = error ? `${id}-error` : `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {optional ? <span className="font-normal text-stone-500"> (optional)</span> : null}
      </label>
      <input
        id={id}
        type={type}
        className={`input ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
      />
      {note ? (
        <p id={noteId} className={`mt-1 text-xs ${error ? 'text-red-600' : 'text-stone-500'}`}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
