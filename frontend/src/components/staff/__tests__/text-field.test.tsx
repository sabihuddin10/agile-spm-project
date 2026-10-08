import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextField, isValidEmail } from '@/components/staff/text-field';

describe('TextField', () => {
  it('ties the hint to the input when there is no error', () => {
    // Arrange / Act
    render(<TextField id="f" label="Email" value="" onChange={vi.fn()} hint="You sign in with this." />);

    // Assert
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('You sign in with this.');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('replaces the hint with the error and marks the input invalid', () => {
    // Arrange / Act
    render(<TextField id="f" label="Email" value="x" onChange={vi.fn()} hint="Hint" error="Enter a valid email address." />);

    // Assert
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('Enter a valid email address.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Hint')).not.toBeInTheDocument();
  });

  it('marks optional fields in the label', () => {
    // Arrange / Act
    render(<TextField id="f" label="Phone" value="" onChange={vi.fn()} optional />);

    // Assert
    expect(screen.getByLabelText('Phone (optional)')).toBeInTheDocument();
  });
});

describe('isValidEmail', () => {
  it('accepts a normal address and rejects malformed ones', () => {
    // Arrange / Act / Assert
    expect(isValidEmail(' sam@rest.test ')).toBe(true);
    expect(isValidEmail('sam@rest')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});
