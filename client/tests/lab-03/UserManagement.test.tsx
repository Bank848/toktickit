import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminUserManagementPage } from '../../src/pages/AdminUserManagementPage';
import * as adminUsersApi from '../../src/api/adminUsers';
import * as authContext from '../../src/context/AuthContext';

const USERS = [
  {
    id: 'u1',
    displayName: 'Alice Admin',
    email: 'alice@toktickit.local',
    role: 'ADMINISTRATOR' as const,
    isActive: true,
    mustChangePassword: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'u2',
    displayName: 'Bob Staff',
    email: 'bob@toktickit.local',
    role: 'IT_STAFF' as const,
    isActive: true,
    mustChangePassword: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminUserManagementPage />
    </MemoryRouter>
  );
}

describe('AdminUserManagementPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      currentUser: { id: 'u1', email: 'alice@toktickit.local', displayName: 'Alice Admin', role: 'ADMINISTRATOR', mustChangePassword: false },
      isLoading: false,
      setCurrentUser: vi.fn(),
      logout: vi.fn(),
    });
    vi.spyOn(adminUsersApi, 'fetchUsers').mockResolvedValue(USERS);
  });

  it('renders every user returned by the list endpoint', async () => {
    renderPage();
    // The list renders once as a desktop table row and once as a mobile card (same dual-DOM,
    // CSS-only-hidden pattern as StaffTicketQueuePage) -- both are always in the DOM in jsdom,
    // which has no stylesheet to apply the d-none/d-md-table breakpoint classes.
    await waitFor(() => expect(screen.getAllByText('Alice Admin').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Bob Staff').length).toBeGreaterThan(0);
  });

  it('re-fetches with the typed search term', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Alice Admin').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByPlaceholderText('Search users…'), { target: { value: 'bob' } });

    await waitFor(() =>
      expect(adminUsersApi.fetchUsers).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'bob' }))
    );
  });

  it('creates a user and refetches the list on success', async () => {
    const createSpy = vi.spyOn(adminUsersApi, 'createUser').mockResolvedValue({
      id: 'u3',
      displayName: 'New Person',
      email: 'new@toktickit.local',
      role: 'REQUESTER',
      isActive: true,
      mustChangePassword: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    renderPage();
    await waitFor(() => expect(screen.getAllByText('Alice Admin').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Person' } });
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'new@toktickit.local' } });
    fireEvent.change(screen.getByLabelText('Initial Password'), { target: { value: 'Str0ng!Pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    await waitFor(() => expect(adminUsersApi.fetchUsers).toHaveBeenCalledTimes(2));
  });

  it('shows a field-level error and keeps the panel open on a duplicate-email rejection', async () => {
    vi.spyOn(adminUsersApi, 'createUser').mockRejectedValue(
      new adminUsersApi.ApiError('This email is already in use', 409, [
        { field: 'email', message: 'This email is already in use' },
      ])
    );

    renderPage();
    await waitFor(() => expect(screen.getAllByText('Alice Admin').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Dup' } });
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'alice@toktickit.local' } });
    fireEvent.change(screen.getByLabelText('Initial Password'), { target: { value: 'Str0ng!Pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }));

    await waitFor(() => expect(screen.getByText('This email is already in use')).toBeInTheDocument());
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument(); // panel still open
  });

  it('disables the Deactivate action on the signed-in Administrator\'s own row', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Alice Admin').length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit Alice Admin' })[0]);

    expect(screen.getByRole('button', { name: 'Deactivate User' })).toBeDisabled();
  });

  it('Set New Password dialog succeeds and does not touch the main edit form\'s other fields (UI-13/AC-30)', async () => {
    const setPasswordSpy = vi.spyOn(adminUsersApi, 'setInitialPassword').mockResolvedValue({
      ...USERS[1],
      mustChangePassword: true,
    });

    renderPage();
    await waitFor(() => expect(screen.getAllByText('Bob Staff').length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit Bob Staff' })[0]);
    expect(screen.getByLabelText('Full Name')).toHaveValue('Bob Staff');

    fireEvent.click(screen.getByRole('button', { name: 'Set New Password' }));
    fireEvent.change(screen.getByLabelText('Initial Password'), { target: { value: 'NewInit!Pass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Password' }));

    await waitFor(() => expect(setPasswordSpy).toHaveBeenCalledWith('u2', 'NewInit!Pass1'));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Password reset — user must change it at next login'),
    );

    // The dialog closes but the edit form underneath is untouched -- Full Name/Email/Role/
    // Active still show the same values they did before the dialog ever opened.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toHaveValue('Bob Staff');
    expect(screen.getByLabelText('Email Address')).toHaveValue('bob@toktickit.local');
  });
});
