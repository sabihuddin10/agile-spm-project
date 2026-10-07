import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BookPage from '@/app/book/page';

vi.mock('@/components/layout/storefront-shell', () => ({ StorefrontShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/booking/booking-form', () => ({ BookingForm: () => <div data-testid="booking-form" /> }));

describe('BookPage', () => {
  it('shows the page heading and the booking form', () => {
    // Arrange / Act
    render(<BookPage />);

    // Assert
    expect(screen.getByRole('heading', { name: 'Reserve your evening' })).toBeInTheDocument();
    expect(screen.getByTestId('booking-form')).toBeInTheDocument();
  });
});
