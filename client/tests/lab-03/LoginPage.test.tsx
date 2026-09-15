import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/App';
import * as authApi from '../../src/api/auth';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchMe').mockRejectedValue(new Error('Not authenticated'));
  });

  it('logs in and navigates to My Tickets on success', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({
      id: 'u1',
      email: 'requester@toktickit.local',
      displayName: 'Ariya',
      role: 'REQUESTER',
      mustChangePassword: false,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/email address/i), 'requester@toktickit.local');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'DevPass123!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/signed in as: ariya/i)).toBeInTheDocument();
    });
  });

  it('navigates to Change Password when mustChangePassword is true', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({
      id: 'u2',
      email: 'onboarding@toktickit.local',
      displayName: 'Nok',
      role: 'REQUESTER',
      mustChangePassword: true,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/email address/i), 'onboarding@toktickit.local');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'DevPass123!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /change your password/i })).toBeInTheDocument();
    });
  });

  it('shows the generic invalid-credentials message and clears the password field', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new authApi.LoginRequestError('INVALID_CREDENTIALS'));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
    await userEvent.type(screen.getByLabelText(/email address/i), 'nobody@toktickit.local');
    await userEvent.type(passwordInput, 'Whatever1!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid email or password/i);
    });
    expect(passwordInput.value).toBe('');
  });

  it('shows the distinct deactivated-account message', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new authApi.LoginRequestError('ACCOUNT_DEACTIVATED'));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/email address/i), 'gone@toktickit.local');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Whatever1!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/deactivated/i);
    });
  });
});
