import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequesterProvider } from '../../src/context/RequesterContext';
import { SelectRequesterPage } from '../../src/pages/SelectRequesterPage';
import * as devApi from '../../src/api/dev';

function renderAt(
  initialEntries: Array<string | { pathname: string; state?: unknown }>,
  initialIndex = initialEntries.length - 1,
) {
  return render(
    <RequesterProvider>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
        <Routes>
          <Route path="/select-requester" element={<SelectRequesterPage />} />
          <Route path="/tickets" element={<div>TICKETS PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </RequesterProvider>,
  );
}

describe('SelectRequesterPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('renders a disabled loading placeholder while requesters are being fetched', () => {
    vi.spyOn(devApi, 'fetchDevRequesters').mockReturnValue(new Promise(() => {}));

    renderAt(['/select-requester']);

    expect(screen.getByText(/loading requesters/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /development requester/i })).toBeDisabled();
  });

  it('renders a labelled empty state when there are no active requesters', async () => {
    vi.spyOn(devApi, 'fetchDevRequesters').mockResolvedValue([]);

    renderAt(['/select-requester']);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no.*development requester/i);
    });
    expect(screen.queryByRole('combobox', { name: /development requester/i })).not.toBeInTheDocument();
  });

  it('renders an inline error banner with Retry when the fetch fails, and Retry re-fetches', async () => {
    const spy = vi
      .spyOn(devApi, 'fetchDevRequesters')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([{ id: 'u1', email: 'a@b.test', displayName: 'Ariya' }]);

    renderAt(['/select-requester']);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to load/i);
    });
    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /development requester/i })).toBeEnabled();
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('enables Continue once a requester is selected from the loaded dropdown', async () => {
    vi.spyOn(devApi, 'fetchDevRequesters').mockResolvedValue([
      { id: 'u1', email: 'a@b.test', displayName: 'Ariya' },
      { id: 'u2', email: 'c@d.test', displayName: 'Narin' },
    ]);

    renderAt(['/select-requester']);

    const select = await screen.findByRole('combobox', { name: /development requester/i });
    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeDisabled();

    fireEvent.change(select, { target: { value: 'u2' } });

    expect(continueButton).toBeEnabled();
  });

  it('calls selectDevRequester on Continue and navigates to My Tickets on success', async () => {
    vi.spyOn(devApi, 'fetchDevRequesters').mockResolvedValue([
      { id: 'u1', email: 'a@b.test', displayName: 'Ariya' },
    ]);
    const selectSpy = vi
      .spyOn(devApi, 'selectDevRequester')
      .mockResolvedValue({ id: 'u1', email: 'a@b.test', displayName: 'Ariya' });

    renderAt(['/select-requester']);

    const select = await screen.findByRole('combobox', { name: /development requester/i });
    fireEvent.change(select, { target: { value: 'u1' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText('TICKETS PAGE')).toBeInTheDocument();
    });
    expect(selectSpy).toHaveBeenCalledWith('u1');
    expect(JSON.parse(sessionStorage.getItem('toktickit.selectedRequesterId')!).id).toBe('u1');
  });

  it('shows an inline error and does not navigate when selectDevRequester fails', async () => {
    vi.spyOn(devApi, 'fetchDevRequesters').mockResolvedValue([
      { id: 'u1', email: 'a@b.test', displayName: 'Ariya' },
    ]);
    vi.spyOn(devApi, 'selectDevRequester').mockRejectedValue(new Error('boom'));

    renderAt(['/select-requester']);

    const select = await screen.findByRole('combobox', { name: /development requester/i });
    fireEvent.change(select, { target: { value: 'u1' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to select/i);
    });
    expect(screen.queryByText('TICKETS PAGE')).not.toBeInTheDocument();
  });

  it('disables Cancel with no effect on first-load fallback (no prior selection)', async () => {
    vi.spyOn(devApi, 'fetchDevRequesters').mockResolvedValue([
      { id: 'u1', email: 'a@b.test', displayName: 'Ariya' },
    ]);

    renderAt(['/select-requester']);

    await screen.findByRole('combobox', { name: /development requester/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeDisabled();
  });

  it('navigates back to the previous location when Cancel is activated after a prior selection', async () => {
    vi.spyOn(devApi, 'fetchDevRequesters').mockResolvedValue([
      { id: 'u1', email: 'a@b.test', displayName: 'Ariya' },
    ]);

    renderAt(
      [
        { pathname: '/tickets' },
        { pathname: '/select-requester', state: { from: 'change-requester' } },
      ],
      1,
    );

    await screen.findByRole('combobox', { name: /development requester/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeEnabled();

    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByText('TICKETS PAGE')).toBeInTheDocument();
    });
  });
});
