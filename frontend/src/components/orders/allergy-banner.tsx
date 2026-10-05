import type { MenuItem, Order } from '@/types';
import { allergyConflicts } from '@/lib/menu';
import { titleCase } from '@/lib/format';

/**
 * Order lines whose dish contains one of the guest's recorded allergens,
 * keyed by order-item id (US1.5). Dishes missing from `menuById` are skipped.
 */
export function orderAllergyFlags(
  order: Pick<Order, 'items' | 'customer'>,
  menuById: Map<string, MenuItem>,
): Record<string, string[]> {
  const allergies = order.customer?.preferences.allergies ?? [];
  const flags: Record<string, string[]> = {};
  if (allergies.length === 0) return flags;
  for (const item of order.items) {
    const dish = menuById.get(item.menuItemId);
    const hits = dish ? allergyConflicts(dish, allergies) : [];
    if (hits.length) flags[item.id] = hits;
  }
  return flags;
}

/**
 * Red allergy alert plus dietary notes for a guest (US1.5). `prominent` is the
 * solid KDS variant; `flaggedDishes` names lines that clash with the allergies.
 */
export function AllergyBanner({
  allergies,
  dietary = [],
  flaggedDishes = [],
  prominent = false,
}: {
  allergies: string[];
  dietary?: string[];
  flaggedDishes?: string[];
  prominent?: boolean;
}) {
  if (allergies.length === 0 && dietary.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {allergies.length > 0 ? (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${
            prominent ? 'border-red-600 bg-red-600 text-white' : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <div className="min-w-0 text-sm">
            <p className={`font-semibold ${prominent ? 'uppercase tracking-wide' : ''}`}>
              Allergy alert: {allergies.map(titleCase).join(', ')}
            </p>
            {flaggedDishes.length > 0 ? (
              <p className={`text-xs ${prominent ? 'text-red-50' : 'text-red-700'}`}>
                Check: {flaggedDishes.join(', ')}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {dietary.length > 0 ? (
        <p className="text-xs text-stone-600">
          <span className="font-semibold">Dietary:</span> {dietary.map(titleCase).join(', ')}
        </p>
      ) : null}
    </div>
  );
}
