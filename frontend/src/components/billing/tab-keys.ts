import type { KeyboardEvent } from 'react';

/**
 * Arrow-key handling for a role="tablist" (WAI-ARIA tabs, automatic activation):
 * ArrowLeft/ArrowRight wrap around, Home/End jump to the ends, disabled tabs are
 * skipped. Put it on the tablist's onKeyDown; tabs use a roving tabIndex
 * (0 on the selected tab, -1 on the rest).
 */
export function handleTabListKeyDown<T>(
  e: KeyboardEvent<HTMLElement>,
  values: readonly T[],
  current: T,
  select: (value: T) => void,
) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const enabled = values.map((_, i) => !tabs[i]?.disabled);
  if (!enabled.some(Boolean)) return;
  e.preventDefault();
  const n = values.length;
  let i = values.indexOf(current);
  const step = (dir: 1 | -1) => {
    do i = (i + dir + n) % n;
    while (!enabled[i]);
  };
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'Home') {
    i = -1;
    step(1);
  } else {
    i = n;
    step(-1);
  }
  select(values[i]);
  tabs[i]?.focus();
}
