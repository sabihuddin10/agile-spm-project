import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CareersPage, { metadata } from '@/app/careers/page';

vi.mock('@/components/layout/storefront-shell', () => ({ StorefrontShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/staff/careers-form', () => ({ CareersForm: () => <div data-testid="careers-form" /> }));

describe('CareersPage', () => {
  it('sets the page title', () => {
    // Arrange / Act / Assert
    expect(metadata.title).toBe('Careers');
  });

  it('shows the heading, perks and the application form', () => {
    // Arrange / Act
    render(<CareersPage />);

    // Assert
    expect(screen.getByRole('heading', { name: 'Join our team' })).toBeInTheDocument();
    expect(screen.getByText('A rota you can plan around')).toBeInTheDocument();
    expect(screen.getByTestId('careers-form')).toBeInTheDocument();
  });
});
