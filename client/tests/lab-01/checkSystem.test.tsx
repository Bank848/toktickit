import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SystemCheckPage as App } from '../../src/pages/SystemCheckPage';
import * as api from '../../src/api';

describe('Check System button', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading, then the category list on success (UI-02)', async () => {
    vi.spyOn(api, 'fetchHealth').mockResolvedValue({ status: 'ok', service: 'TokTickIT API' });
    vi.spyOn(api, 'fetchCategories').mockResolvedValue([
      { id: 1, name: 'Account and Access' },
      { id: 2, name: 'Hardware' },
      { id: 3, name: 'Software' },
      { id: 4, name: 'Network' },
    ]);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /check system/i }));

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Account and Access')).toBeInTheDocument();
    });
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Software')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
  });

  it('shows a useful error message when the API call fails (UI-03)', async () => {
    vi.spyOn(api, 'fetchHealth').mockRejectedValue(new Error('network error'));

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /check system/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to connect to TokTickIT API');
    });
    expect(screen.getByText(/system status/i)).toHaveTextContent('Offline');
  });
});
