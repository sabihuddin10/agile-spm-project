import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/spinner';
import { ToastProvider, useToast } from '@/components/ui/toast';

describe('Badge', () => {
  it('applies the tone class for the given tone', () => {
    // Arrange / Act
    render(<Badge tone="red">Urgent</Badge>);

    // Assert
    expect(screen.getByText('Urgent')).toHaveClass('bg-red-100', 'text-red-700');
  });

  it('defaults to the stone tone when none is given', () => {
    // Arrange / Act
    render(<Badge>Plain</Badge>);

    // Assert
    expect(screen.getByText('Plain')).toHaveClass('bg-stone-100', 'text-stone-600');
  });
});

describe('Card', () => {
  it('renders children inside a card container', () => {
    // Arrange / Act
    render(<Card className="extra">Body content</Card>);

    // Assert
    expect(screen.getByText('Body content')).toHaveClass('card', 'extra');
  });

  it('renders a title, optional subtitle and optional action', () => {
    // Arrange / Act
    render(<CardHeader title="Billing" subtitle="This month" action={<button>Export</button>} />);

    // Assert
    expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument();
    expect(screen.getByText('This month')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('omits the subtitle and action when not provided', () => {
    // Arrange / Act
    render(<CardHeader title="Billing" />);

    // Assert
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('shows a title, hint and action when given', () => {
    // Arrange / Act
    render(<EmptyState title="No orders yet" hint="Orders will appear here." action={<button>Refresh</button>} />);

    // Assert
    expect(screen.getByText('No orders yet')).toBeInTheDocument();
    expect(screen.getByText('Orders will appear here.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('renders without a hint or action', () => {
    // Arrange / Act
    render(<EmptyState title="Nothing here" />);

    // Assert
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('PageHeader', () => {
  it('renders a title, subtitle and action', () => {
    // Arrange / Act
    render(<PageHeader title="Orders" subtitle="Today's activity" action={<button>New order</button>} />);

    // Assert
    expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByText("Today's activity")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New order' })).toBeInTheDocument();
  });
});

describe('Spinner', () => {
  it('shows a default loading label', () => {
    // Arrange / Act
    render(<Spinner />);

    // Assert
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows a custom label when given', () => {
    // Arrange / Act
    render(<Spinner label="Saving…" />);

    // Assert
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('renders the title and children', () => {
    // Arrange / Act
    render(
      <Modal title="Confirm" onClose={vi.fn()}>
        <p>Are you sure?</p>
      </Modal>,
    );

    // Assert
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('closes when the close button is clicked', async () => {
    // Arrange
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal title="Confirm" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Close' }));

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the Escape key is pressed', async () => {
    // Arrange
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal title="Confirm" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    // Act
    await user.keyboard('{Escape}');

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked but not when the panel itself is clicked', async () => {
    // Arrange
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal title="Confirm" onClose={onClose}>
        <p>Body text</p>
      </Modal>,
    );

    // Act
    await user.click(screen.getByText('Body text'));
    // Assert: clicking inside the panel does not close it
    expect(onClose).not.toHaveBeenCalled();

    // Act: clicking the backdrop (the dialog container itself) closes it
    await user.click(screen.getByRole('dialog', { name: 'Confirm' }));

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function ToastDemo() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast('Saved successfully', 'success')}>Fire success</button>
      <button onClick={() => toast('Something failed', 'error')}>Fire error</button>
    </div>
  );
}

describe('ToastProvider / useToast', () => {
  it('shows a toast message when triggered and allows dismissing it', async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastDemo />
      </ToastProvider>,
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Fire success' }));

    // Assert
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();

    // Act: dismiss it
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    // Assert
    await waitFor(() => expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument());
  });

  it('shows multiple toasts with tone-specific styling', async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastDemo />
      </ToastProvider>,
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Fire success' }));
    await user.click(screen.getByRole('button', { name: 'Fire error' }));

    // Assert
    expect(screen.getByText('Saved successfully').closest('div')).toHaveClass('border-emerald-200');
    expect(screen.getByText('Something failed').closest('div')).toHaveClass('border-red-200');
  });

  it('throws when useToast is called outside a ToastProvider', () => {
    // Arrange
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act / Assert
    expect(() => render(<ToastDemo />)).toThrow('useToast must be used within a ToastProvider');

    spy.mockRestore();
  });
});
