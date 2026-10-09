import { monthLabel } from '@/components/workforce/workforce-format';

/** Month select ('YYYY-MM'), newest first. */
export function MonthPicker({
  value,
  months,
  onChange,
  id = 'month-picker',
}: {
  value: string;
  months: string[];
  onChange: (month: string) => void;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium text-stone-600">
        Month
      </label>
      <select id={id} className="input !w-auto py-1.5" value={value} onChange={(e) => onChange(e.target.value)}>
        {months.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
    </div>
  );
}
