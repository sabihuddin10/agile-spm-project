import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { collectErrors, useFormValidation, type Rules } from '@/lib/validation/use-form-validation';

interface Form {
  name: string;
  age: string;
}

const RULES: Rules<Form> = {
  name: (v) => (v.trim() ? undefined : 'Name needed.'),
  age: (v) => (/^\d+$/.test(v) ? undefined : 'Age must be digits.'),
};

describe('collectErrors', () => {
  it('returns every failing field', () => {
    // Act
    const errors = collectErrors({ name: '', age: '12' }, RULES);

    // Assert
    expect(errors).toEqual({ name: 'Name needed.' });
  });
});

describe('useFormValidation', () => {
  it('hides errors until a field is blurred, then tracks the value live', () => {
    // Arrange
    const { result, rerender } = renderHook(({ values }) => useFormValidation(values, RULES), {
      initialProps: { values: { name: '', age: 'x' } },
    });

    // Assert — nothing shown before interaction
    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(false);

    // Act
    act(() => result.current.blur('age'));

    // Assert
    expect(result.current.errors).toEqual({ age: 'Age must be digits.' });

    // Act — fixing the value clears the error without another blur
    rerender({ values: { name: '', age: '30' } });

    // Assert
    expect(result.current.errors).toEqual({});
  });

  it('shows an error as soon as a field has been typed in (dirty), and lists what is still invalid', () => {
    // Arrange
    const { result, rerender } = renderHook(
      ({ values }) => useFormValidation(values, RULES, { labels: { name: 'Full name', age: 'Age' } }),
      { initialProps: { values: { name: '', age: '' } } },
    );

    // Assert — pristine: no field errors, but the form knows it is invalid
    expect(result.current.errors).toEqual({});
    expect(result.current.dirty).toBe(false);
    expect(result.current.invalidLabels).toEqual(['Full name', 'Age']);

    // Act — type one letter into age
    rerender({ values: { name: '', age: 'a' } });

    // Assert
    expect(result.current.errors).toEqual({ age: 'Age must be digits.' });
    expect(result.current.dirty).toBe(true);

    // Act — clearing it again keeps it dirty, so the error stays visible
    rerender({ values: { name: '', age: '' } });

    // Assert
    expect(result.current.errors).toEqual({ age: 'Age must be digits.' });

    // Act
    rerender({ values: { name: 'Ana', age: '30' } });

    // Assert
    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(true);
    expect(result.current.invalidLabels).toEqual([]);
  });

  it('reset makes the current values the new pristine baseline', () => {
    // Arrange
    const { result, rerender } = renderHook(({ values }) => useFormValidation(values, RULES), {
      initialProps: { values: { name: '', age: 'x' } },
    });
    rerender({ values: { name: '', age: 'xy' } });
    expect(result.current.errors).toEqual({ age: 'Age must be digits.' });

    // Act
    act(() => result.current.reset());
    rerender({ values: { name: '', age: 'xy' } });

    // Assert
    expect(result.current.errors).toEqual({});
    expect(result.current.dirty).toBe(false);
  });

  it('touchAll shows every error and reports validity; reset hides them again', () => {
    // Arrange
    const { result } = renderHook(() => useFormValidation({ name: '', age: '1' }, RULES));
    let valid = true;

    // Act
    act(() => {
      valid = result.current.touchAll();
    });

    // Assert
    expect(valid).toBe(false);
    expect(result.current.submitted).toBe(true);
    expect(result.current.errors).toEqual({ name: 'Name needed.' });

    // Act
    act(() => result.current.reset());

    // Assert
    expect(result.current.errors).toEqual({});
  });
});
