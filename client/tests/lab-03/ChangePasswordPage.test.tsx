import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/App';
import * as authApi from '../../src/api/auth';

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue({
      id: 'u1',
      email: 'onboarding@toktickit.local',
      displayName: 'Nok',
      role: 'REQUESTER',
      mustChangePassword: true,
    });
  });

  it('submits and navigates to the role home route on success (AC-09)', async () => {
    vi.spyOn(authApi, 'changePassword').mockResolvedValue({
      id: 'u1',
      email: 'onboarding@toktickit.local',
      displayName: 'Nok',
      role: 'REQUESTER',
      mustChangePassword: false,
    });

    render(
      <MemoryRouter initialEntries={['/change-password']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByLabelText(/current \(temporary\) password/i));
    await userEvent.type(screen.getByLabelText(/current \(temporary\) password/i), 'DevPass123!');
    await userEvent.type(screen.getByLabelText(/^new password$/i), 'NewStrong1!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'NewStrong1!');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/signed in as: nok/i)).toBeInTheDocument();
    });
  });

  it('shows a field error for an incorrect current password and does not navigate (AC-10)', async () => {
    vi.spyOn(authApi, 'changePassword').mockRejectedValue(
      new authApi.ChangePasswordRequestError('INVALID_CURRENT_PASSWORD'),
    );

    render(
      <MemoryRouter initialEntries={['/change-password']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByLabelText(/current \(temporary\) password/i));
    await userEvent.type(screen.getByLabelText(/current \(temporary\) password/i), 'WrongPass000!');
    await userEvent.type(screen.getByLabelText(/^new password$/i), 'NewStrong1!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'NewStrong1!');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /change your password/i })).toBeInTheDocument();
  });

  it('disables Continue until the policy checklist and confirmation match', async () => {
    render(
      <MemoryRouter initialEntries={['/change-password']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByLabelText(/current \(temporary\) password/i));
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/current \(temporary\) password/i), 'DevPass123!');
    await userEvent.type(screen.getByLabelText(/^new password$/i), 'weak');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'weak');
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });
});
