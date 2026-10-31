import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StaffTicketQueuePage } from '../../src/pages/StaffTicketQueuePage';
import * as staffTicketsApi from '../../src/api/staffTickets';

describe('StaffTicketQueuePage — URL filter hydration (FR-10)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(staffTicketsApi, 'fetchAssignableOwners').mockResolvedValue([]);
  });

  it('reads an initial itPriority filter from the URL query string set by a dashboard link', async () => {
    const fetchSpy = vi.spyOn(staffTicketsApi, 'fetchStaffTickets').mockResolvedValue({
      data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
    render(
      <MemoryRouter initialEntries={['/staff/tickets?itPriority=URGENT']}>
        <Routes><Route path="/staff/tickets" element={<StaffTicketQueuePage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ itPriority: 'URGENT' }));
  });

  it('reads an initial ownerId filter (including the literal "unassigned") from the URL', async () => {
    const fetchSpy = vi.spyOn(staffTicketsApi, 'fetchStaffTickets').mockResolvedValue({
      data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
    render(
      <MemoryRouter initialEntries={['/staff/tickets?ownerId=unassigned']}>
        <Routes><Route path="/staff/tickets" element={<StaffTicketQueuePage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'unassigned' }));
  });

  it('falls back to the unfiltered default when no query string is present (unchanged Lab 1-3 behavior)', async () => {
    const fetchSpy = vi.spyOn(staffTicketsApi, 'fetchStaffTickets').mockResolvedValue({
      data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
    render(
      <MemoryRouter initialEntries={['/staff/tickets']}>
        <Routes><Route path="/staff/tickets" element={<StaffTicketQueuePage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    // loadTickets() maps an empty-string filter to `null` (see client/tests/lab-03/StaffTicketQueuePage.test.tsx
    // line 111, which pins the same convention for Lab 1-3), not `undefined` — adapted from the task
    // draft's `undefined` to match that established, already-tested behavior.
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ status: [], itPriority: null, ownerId: null }));
  });
});
