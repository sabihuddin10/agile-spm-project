import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SprintCard } from '@/components/scrum/sprint-card';
import type { SprintBacklog, Story } from '@/data/backlog';

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 'US1.1',
    text: 'As a customer I can browse the menu',
    points: 3,
    acceptanceCriteria: ['Menu items load', 'Prices are shown'],
    evidence: { screen: 'Storefront menu page', test: 'routes/menu.test.js' },
    ...overrides,
  };
}

function makeSprint(overrides: Partial<SprintBacklog> = {}): SprintBacklog {
  return {
    sprint: 1,
    module: 'Menu',
    goal: 'Let customers browse the menu online',
    priority: 'Must',
    lead: 'Sabih',
    status: 'planned',
    stakeholders: ['Product Owner', 'Customers'],
    stories: [makeStory()],
    ...overrides,
  };
}

describe('SprintCard', () => {
  it('shows the sprint number, module, goal, priority and lead', () => {
    // Arrange
    const sprint = makeSprint();

    // Act
    render(<SprintCard sprint={sprint} />);

    // Assert
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.getByText('Let customers browse the menu online')).toBeInTheDocument();
    expect(screen.getByText('Must')).toBeInTheDocument();
    expect(screen.getByText('Sabih', { exact: false })).toBeInTheDocument();
  });

  it('shows a "Planned" badge for a planned sprint and "Delivered" for a done sprint', () => {
    // Arrange / Act
    const { rerender } = render(<SprintCard sprint={makeSprint({ status: 'planned' })} />);

    // Assert
    expect(screen.getByText('Planned')).toBeInTheDocument();

    // Act
    rerender(<SprintCard sprint={makeSprint({ status: 'done' })} />);

    // Assert
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('shows the total points and story count', () => {
    // Arrange
    const sprint = makeSprint({
      stories: [makeStory({ id: 'US1.1', points: 3 }), makeStory({ id: 'US1.2', points: 5 })],
    });

    // Act
    render(<SprintCard sprint={sprint} />);

    // Assert
    expect(screen.getByText(/8 pts/)).toBeInTheDocument();
    expect(screen.getByText(/2 stories/)).toBeInTheDocument();
  });

  it('expands a story to show its acceptance criteria and evidence, then collapses it again', async () => {
    // Arrange
    const sprint = makeSprint({ stories: [makeStory({ id: 'US1.1', text: 'Browse the menu' })] });
    const user = userEvent.setup();
    render(<SprintCard sprint={sprint} />);
    expect(screen.queryByText('Acceptance criteria')).not.toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: /Browse the menu/i }));

    // Assert
    expect(screen.getByText('Acceptance criteria')).toBeInTheDocument();
    expect(screen.getByText('Menu items load')).toBeInTheDocument();
    expect(screen.getByText('routes/menu.test.js', { exact: false })).toBeInTheDocument();

    // Act: collapse again
    await user.click(screen.getByRole('button', { name: /Browse the menu/i }));

    // Assert
    expect(screen.queryByText('Acceptance criteria')).not.toBeInTheDocument();
  });

  it('only expands one story at a time', async () => {
    // Arrange
    const sprint = makeSprint({
      stories: [makeStory({ id: 'US1.1', text: 'First story' }), makeStory({ id: 'US1.2', text: 'Second story' })],
    });
    const user = userEvent.setup();
    render(<SprintCard sprint={sprint} />);

    // Act
    await user.click(screen.getByRole('button', { name: /First story/i }));
    await user.click(screen.getByRole('button', { name: /Second story/i }));

    // Assert: only the second story's criteria are visible
    const criteriaHeadings = screen.getAllByText('Acceptance criteria');
    expect(criteriaHeadings).toHaveLength(1);
  });
});
