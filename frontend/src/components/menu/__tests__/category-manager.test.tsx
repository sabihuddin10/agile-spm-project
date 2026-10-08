import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryManager } from '@/components/menu/category-manager';
import type { MenuCategory } from '@/types';

function makeCategory(overrides: Partial<MenuCategory> = {}): MenuCategory {
  return { id: 'cat_1', name: 'Mains', sort: 0, active: true, itemCount: 0, ...overrides };
}

describe('CategoryManager', () => {
  it('creates a category and clears the input on success', async () => {
    // Arrange
    const onCreate = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup({ delay: null });
    render(<CategoryManager categories={[]} onCreate={onCreate} onRename={vi.fn()} onToggleActive={vi.fn()} onDelete={vi.fn()} />);

    // Act
    await user.type(screen.getByLabelText('New category name'), 'Desserts');
    await user.click(screen.getByRole('button', { name: /add/i }));

    // Assert
    expect(onCreate).toHaveBeenCalledWith('Desserts');
    expect(screen.getByLabelText('New category name')).toHaveValue('');
  });

  it('does not submit a blank category name', () => {
    // Arrange / Act
    render(<CategoryManager categories={[]} onCreate={vi.fn()} onRename={vi.fn()} onToggleActive={vi.fn()} onDelete={vi.fn()} />);

    // Assert
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled();
  });

  it('renames a category and exits edit mode on success', async () => {
    // Arrange
    const onRename = vi.fn().mockResolvedValue(true);
    const category = makeCategory();
    const user = userEvent.setup({ delay: null });
    render(<CategoryManager categories={[category]} onCreate={vi.fn()} onRename={onRename} onToggleActive={vi.fn()} onDelete={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Rename Mains');
    await user.clear(input);
    await user.type(input, 'Main Courses');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(onRename).toHaveBeenCalledWith(category, 'Main Courses');
    expect(screen.queryByLabelText('Rename Mains')).not.toBeInTheDocument();
  });

  it('hides an empty category from the delete-block message and allows deleting it', async () => {
    // Arrange
    const onDelete = vi.fn();
    const category = makeCategory({ itemCount: 0 });
    const user = userEvent.setup({ delay: null });
    render(<CategoryManager categories={[category]} onCreate={vi.fn()} onRename={vi.fn()} onToggleActive={vi.fn()} onDelete={onDelete} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // Assert
    expect(onDelete).toHaveBeenCalledWith(category);
  });

  it('blocks deleting a category that still has items', () => {
    // Arrange / Act
    render(<CategoryManager categories={[makeCategory({ itemCount: 3 })]} onCreate={vi.fn()} onRename={vi.fn()} onToggleActive={vi.fn()} onDelete={vi.fn()} />);

    // Assert
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('toggles a category\'s visibility', async () => {
    // Arrange
    const onToggleActive = vi.fn();
    const category = makeCategory({ active: true });
    const user = userEvent.setup({ delay: null });
    render(<CategoryManager categories={[category]} onCreate={vi.fn()} onRename={vi.fn()} onToggleActive={onToggleActive} onDelete={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('switch', { name: /show mains to customers/i }));

    // Assert
    expect(onToggleActive).toHaveBeenCalledWith(category);
  });

  it('flags a hidden category', () => {
    // Arrange / Act
    render(<CategoryManager categories={[makeCategory({ active: false })]} onCreate={vi.fn()} onRename={vi.fn()} onToggleActive={vi.fn()} onDelete={vi.fn()} />);

    // Assert
    expect(screen.getByText('Hidden from customers')).toBeInTheDocument();
  });
});
