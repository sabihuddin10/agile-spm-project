import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScrumBoardPage from '@/app/dev/page';
import { useAuth } from '@/context/auth-context';
import { SPRINTS, TEAM_ROSTER } from '@/data/backlog';
import type { User } from '@/types';

vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/layout/dev-shell', () => ({ DevShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/scrum/sprint-card', () => ({ SprintCard: ({ sprint }: { sprint: { sprint: number } }) => <div data-testid={`sprint-card-${sprint.sprint}`} /> }));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', name: 'Jamie', email: 'jamie@rest.test', role: 'manager', active: true, ...overrides };
}

describe('ScrumBoardPage', () => {
  it('renders nothing while the session is loading', () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as unknown as ReturnType<typeof useAuth>);
    const { container } = render(<ScrumBoardPage />);

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it('asks a signed-out visitor to sign in', () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as unknown as ReturnType<typeof useAuth>);
    render(<ScrumBoardPage />);

    // Assert
    expect(screen.getByRole('link', { name: 'sign in' })).toHaveAttribute('href', '/login');
  });

  it('shows the backlog summary, Definition of Done, every sprint card and the team roster for a signed-in user', () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: makeUser(), loading: false } as unknown as ReturnType<typeof useAuth>);
    render(<ScrumBoardPage />);

    // Assert
    expect(screen.getByRole('heading', { name: 'Scrum board' })).toBeInTheDocument();
    expect(screen.getByText('Definition of Done')).toBeInTheDocument();
    for (const sprint of SPRINTS) {
      expect(screen.getByTestId(`sprint-card-${sprint.sprint}`)).toBeInTheDocument();
    }
    for (const member of TEAM_ROSTER) {
      expect(screen.getByText(member.id)).toBeInTheDocument();
    }
  });
});
