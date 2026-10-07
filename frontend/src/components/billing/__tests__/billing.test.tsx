/**
 * Module-wise test scaffold for src/components/billing (components).
 *
 * Real tests for this module go here, in __tests__/, mirroring the
 * app/ and components/ directory structure. Follow the Arrange-Act-Assert
 * (AAA) pattern used in src/lib/__tests__/menu.test.ts,
 * src/components/menu/__tests__/menu-item-card.test.tsx and
 * src/components/account/__tests__/profile-editor.test.tsx — Arrange the
 * data/props, Act (render / interact), then Assert the outcome, with each
 * phase commented.
 */
import { test } from 'vitest';

// bill-summary, bill-utils, payment-actions, refund-dialog, split-parts,
// tip-control and use-bill-action now have real tests in this folder.
test.todo('bill-list: renders open/today/all bills and lets staff pick one');
test.todo('bill-panel: assembles the bill detail view (lines, tip, split, pay actions) for one invoice');
test.todo('receipt: renders a paid invoice as a printable receipt');
test.todo('split-dialog: starts an even or by-items split and validates the groups');
