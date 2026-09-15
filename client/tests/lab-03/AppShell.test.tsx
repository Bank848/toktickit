import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/App';
import * as authApi from '../../src/api/auth';

describe('AppShell navigation and logout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows only the Requester nav items for a Requester', async () => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue({
      id: 'u1',
      email: 'a@b.test',
      displayName: 'Ariya',
      role: 'REQUESTER',
      mustChangePassword: false,
    });

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole('link', { name: /my tickets/i }));
    expect(screen.getByRole('link', { name: /create ticket/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /my queue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^users$/i })).not.toBeInTheDocument();
  });

  it('logs out and returns to /login', async () => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue({
      id: 'u1',
      email: 'a@b.test',
      displayName: 'Ariya',
      role: 'REQUESTER',
      mustChangePassword: false,
    });
    vi.spyOn(authApi, 'logout').mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole('button', { name: /logout/i }));
    await userEvent.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in to your account/i })).toBeInTheDocument();
    });
    expect(authApi.logout).toHaveBeenCalledOnce();
  });
});
