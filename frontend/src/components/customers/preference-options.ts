/** Dietary preferences a customer can record (US1.5) — matches the menu's dietary tags. */
export const DIETARY_OPTIONS = ['vegetarian', 'vegan', 'gluten-free', 'halal', 'keto', 'nut-free'];

/** Allergies a customer can record (US1.5, US2.4) — matches the menu's allergen list. */
export const ALLERGY_OPTIONS = ['gluten', 'dairy', 'eggs', 'peanuts', 'tree nuts', 'shellfish', 'fish', 'soy', 'sesame'];

/** The standard options plus any custom values already on a profile (so nothing recorded is hidden). */
export function optionsWith(options: string[], current: string[]): string[] {
  return [...options, ...current.filter((v) => !options.includes(v))];
}

export function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
