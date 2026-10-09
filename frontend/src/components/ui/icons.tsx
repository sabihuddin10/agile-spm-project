/**
 * Shared Heroicons (outline, 1.5 stroke) for controls. Use these instead of
 * text characters such as ✕ ↑ ↓ ⚠ ✓. Decorative by default (aria-hidden);
 * give the surrounding button an aria-label.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Outline({ d, className = 'h-4 w-4', ...rest }: IconProps & { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" focusable="false" className={className} {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export const XMarkIcon = (p: IconProps) => <Outline d="M6 18 18 6M6 6l12 12" {...p} />;
export const CheckIcon = (p: IconProps) => <Outline d="m4.5 12.75 6 6 9-13.5" {...p} />;
export const ArrowUpIcon = (p: IconProps) => <Outline d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" {...p} />;
export const ArrowDownIcon = (p: IconProps) => <Outline d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" {...p} />;
export const ChevronRightIcon = (p: IconProps) => <Outline d="m8.25 4.5 7.5 7.5-7.5 7.5" {...p} />;
export const ExclamationTriangleIcon = (p: IconProps) => (
  <Outline d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" {...p} />
);
export const EllipsisHorizontalIcon = (p: IconProps) => (
  <Outline d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" {...p} />
);
