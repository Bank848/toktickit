import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/App';
import * as devApi from '../../src/api/dev';

const STORAGE_KEY = 'toktickit.selectedRequesterId';

describe('route guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    vi.spyOn(devApi, 'fetchDevRequesters').mockResolvedValue([]);
  });

  it('redirects to /select-requester when no requester is selected', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /select development requester/i })).toBeInTheDocument();
    });
  });

  it('renders the guarded route without redirecting when a requester is pre-seeded', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'u1', email: 'a@b.test', displayName: 'Ariya' }),
    );

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/testing as: ariya/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: /select development requester/i })).not.toBeInTheDocument();
  });
});
