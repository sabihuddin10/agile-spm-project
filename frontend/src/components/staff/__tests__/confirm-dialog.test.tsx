import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/staff/confirm-dialog';

describe('ConfirmDialog', () => {
  it('confirms and cancels via their respective buttons', async () => {
    // Arrange
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog title="Remove staff member?" confirmLabel="Remove" onConfirm={onConfirm} onCancel={onCancel}>
        This cannot be undone.
      </ConfirmDialog>,
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    // Assert
    expect(onConfirm).toHaveBeenCalled();

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    // Assert
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables both buttons and ignores close while busy', async () => {
    // Arrange
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog title="Removing…" confirmLabel="Remove" busy onConfirm={vi.fn()} onCancel={onCancel}>
        Working.
      </ConfirmDialog>,
    );

    // Assert
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled();

    // Act — the modal's own close button should be a no-op while busy
    await user.click(screen.getByRole('button', { name: 'Close' }));
    // Assert
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('uses the primary style when danger is turned off', () => {
    // Arrange / Act
    render(
      <ConfirmDialog title="Approve?" confirmLabel="Approve" danger={false} onConfirm={vi.fn()} onCancel={vi.fn()}>
        Confirm approval.
      </ConfirmDialog>,
    );

    // Assert
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveClass('btn-primary');
  });
});
