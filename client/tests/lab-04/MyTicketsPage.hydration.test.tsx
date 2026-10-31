import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MyTicketsPage } from '../../src/pages/MyTicketsPage';
import * as ticketsApi from '../../src/api/tickets';
import * as lookupsApi from '../../src/api/lookups';

describe('MyTicketsPage — URL filter hydration (FR-10)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(lookupsApi, 'fetchCategories').mockResolvedValue([]);
  });

  it('reads an initial status filter from the URL query string set by a dashboard link', async () => {
    const fetchSpy = vi.spyOn(ticketsApi, 'fetchTickets').mockResolvedValue({
      data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
    render(
      <MemoryRouter initialEntries={['/tickets?status=OPEN']}>
        <Routes><Route path="/tickets" element={<MyTicketsPage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ status: ['OPEN'] }));
  });

  it('falls back to the unfiltered default when no query string is present (unchanged Lab 1-3 behavior)', async () => {
    const fetchSpy = vi.spyOn(ticketsApi, 'fetchTickets').mockResolvedValue({
      data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <Routes><Route path="/tickets" element={<MyTicketsPage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ status: [] }));
  });
});
