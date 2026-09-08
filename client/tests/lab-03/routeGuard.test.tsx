import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/App';
import * as authApi from '../../src/api/auth';

describe('route guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to /login when no session exists', async () => {
    vi.spyOn(authApi, 'fetchMe').mockRejectedValue(new Error('Not authenticated'));

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in to your account/i })).toBeInTheDocument();
    });
  });

  it('renders the guarded route without redirecting for an authenticated Requester', async () => {
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

    await waitFor(() => {
      expect(screen.getByText(/signed in as: ariya/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: /sign in to your account/i })).not.toBeInTheDocument();
  });

  it('redirects to /change-password when mustChangePassword is true', async () => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue({
      id: 'u2',
      email: 'c@d.test',
      displayName: 'Chai',
      role: 'REQUESTER',
      mustChangePassword: true,
    });

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /change your password/i })).toBeInTheDocument();
    });
  });
});
