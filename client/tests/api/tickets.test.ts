import { describe, it, expect } from 'vitest';
import { createTicket, fetchTickets, fetchTicketDetail, ApiError } from '../../src/api/tickets';
import { API_BASE_URL, mockJsonResponse, resetFetchAfterEach, stubFetch } from './testHelpers';

resetFetchAfterEach();

describe('createTicket', () => {
  it('POSTs the payload as JSON and returns the created ticket', async () => {
    const fetchMock = stubFetch();
    const created = { id: 't1', ticketNo: 'TCK-1' };
    fetchMock.mockResolvedValue(mockJsonResponse(created, 201));

    const payload = {
      summary: 'Printer is on fire',
      description: 'Smoke coming out of the tray',
      categoryId: 3,
      relatedSystemId: null,
      requestedPriority: 'HIGH' as const,
    };

    const result = await createTicket(payload);

    expect(result).toEqual(created);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/tickets`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it('throws ApiError with the server message/status/fieldErrors on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(
      mockJsonResponse(
        { error: { message: 'Category is required', fieldErrors: [{ field: 'categoryId', message: 'Required' }] } },
        400,
      ),
    );

    await expect(
      createTicket({
        summary: 'x',
        description: 'y',
        categoryId: 0,
        relatedSystemId: null,
        requestedPriority: 'LOW',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Category is required',
      status: 400,
      fieldErrors: [{ field: 'categoryId', message: 'Required' }],
    });
  });

  it('falls back to a default message when the error body has no error.message', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({}, 500));

    await expect(
      createTicket({
        summary: 'x',
        description: 'y',
        categoryId: 1,
        relatedSystemId: null,
        requestedPriority: 'LOW',
      }),
    ).rejects.toMatchObject(new ApiError('Failed to create ticket', 500, []));
  });
});

describe('fetchTickets', () => {
  it('requests the collection with no query string when called with no args', async () => {
    const fetchMock = stubFetch();
    const listResult = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
    fetchMock.mockResolvedValue(mockJsonResponse(listResult));

    const result = await fetchTickets();

    expect(result).toEqual(listResult);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/tickets`, { credentials: 'include' });
  });

  it('serializes status[], categoryId, q, page, pageSize, and sort into the query string', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ data: [], meta: {} }));

    await fetchTickets({
      status: ['OPEN', 'IN_PROGRESS'],
      categoryId: 5,
      q: 'printer',
      page: 2,
      pageSize: 10,
      sort: '-createdAt',
    });

    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(url as string);
    expect(parsed.pathname).toBe('/api/v1/tickets');
    expect(parsed.searchParams.getAll('status')).toEqual(['OPEN', 'IN_PROGRESS']);
    expect(parsed.searchParams.get('categoryId')).toBe('5');
    expect(parsed.searchParams.get('q')).toBe('printer');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('pageSize')).toBe('10');
    expect(parsed.searchParams.get('sort')).toBe('-createdAt');
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'nope' } }, 403));

    await expect(fetchTickets()).rejects.toMatchObject({ name: 'ApiError', message: 'nope', status: 403 });
  });
});

describe('fetchTicketDetail', () => {
  it('GETs the ticket by id', async () => {
    const fetchMock = stubFetch();
    const detail = { id: 't1', ticketNo: 'TCK-1' };
    fetchMock.mockResolvedValue(mockJsonResponse(detail));

    const result = await fetchTicketDetail('t1');

    expect(result).toEqual(detail);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/tickets/t1`, { credentials: 'include' });
  });

  it('throws ApiError when the ticket is not found', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Ticket not found' } }, 404));

    await expect(fetchTicketDetail('missing')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Ticket not found',
      status: 404,
    });
  });
});
