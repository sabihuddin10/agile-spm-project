import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordRequirements } from '@/components/forms/password-requirements';
import { PasswordInput } from '@/components/forms/password-input';
import { PasswordMatch } from '@/components/forms/password-match';
import { FieldError, describedBy } from '@/components/forms/field-error';

describe('PasswordRequirements', () => {
  it('marks met rules with a check and pending rules as neutral', () => {
    // Arrange / Act
    render(<PasswordRequirements value="abc" />);

    // Assert
    expect(screen.getByText('A lowercase letter').closest('li')).toHaveClass('text-emerald-700');
    expect(screen.getByText('A number').closest('li')).toHaveClass('text-stone-500');
    expect(screen.getByText('A number')).toHaveTextContent('(not met yet)');
    expect(screen.getByRole('status')).toHaveTextContent('1 of 5 requirements met');
    expect(screen.getByText('Strength: Weak')).toBeInTheDocument();
  });

  it('turns unmet rules red only after a submit attempt', () => {
    // Arrange / Act
    render(<PasswordRequirements value="abc" showUnmet />);

    // Assert
    expect(screen.getByText('A number').closest('li')).toHaveClass('text-red-600');
  });

  it('shows the strength as text, and extra problems such as a common password', () => {
    // Arrange / Act
    const { rerender } = render(<PasswordRequirements value="" />);

    // Assert
    expect(screen.getByText('Strength: –')).toBeInTheDocument();

    // Act
    rerender(<PasswordRequirements value="Password1!" />);

    // Assert
    expect(screen.getByText(/too common/)).toBeInTheDocument();

    // Act
    rerender(<PasswordRequirements value="Grill-master7" tone="dark" />);

    // Assert
    expect(screen.getByText('Strength: Strong')).toBeInTheDocument();
    expect(screen.getByText('A number').closest('li')).toHaveClass('text-emerald-300');
  });
});

describe('PasswordInput', () => {
  it('toggles between hidden and visible with an accessible pressed button', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="pw">Password</label>
        <PasswordInput id="pw" value="secret" onChange={onChange} describedBy="pw-hint" />
        <p id="pw-hint">Hint</p>
      </>,
    );
    const input = screen.getByLabelText('Password');

    // Assert
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAccessibleDescription('Hint');

    // Act
    await user.click(screen.getByRole('button', { name: 'Show password' }));

    // Assert
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');

    // Act
    await user.type(input, 'x');

    // Assert
    expect(onChange).toHaveBeenCalledWith('secretx');
  });
});

describe('PasswordMatch', () => {
  it('stays silent when empty, then says whether the passwords match', () => {
    // Arrange / Act
    const { container, rerender } = render(<PasswordMatch id="m" password="Abc-1234" confirm="" />);

    // Assert
    expect(container).toHaveTextContent('');

    // Act
    rerender(<PasswordMatch id="m" password="Abc-1234" confirm="Abc" />);

    // Assert
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();

    // Act
    rerender(<PasswordMatch id="m" password="Abc-1234" confirm="Abc-1234" />);

    // Assert
    expect(screen.getByText('Passwords match')).toBeInTheDocument();
  });
});

describe('FieldError and describedBy', () => {
  it('renders only with a message and joins describing ids', () => {
    // Arrange / Act
    const { container, rerender } = render(<FieldError id="e" />);

    // Assert
    expect(container).toBeEmptyDOMElement();

    // Act
    rerender(<FieldError id="e" message="Wrong." />);

    // Assert
    expect(screen.getByText('Wrong.')).toHaveAttribute('id', 'e');
    expect(describedBy('a', false, undefined, 'b')).toBe('a b');
    expect(describedBy(false)).toBeUndefined();
  });
});
