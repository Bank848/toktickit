import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  fetchStaffTickets,
  fetchAssignableOwners,
  fetchStaffTicketDetail,
  updateTicketOwner,
  updateTicketPriority,
  updateTicketStatus,
  fetchStaffComments,
  postStaffComment,
  fetchStaffNotes,
  postStaffNote,
  fetchStaffTicketAttachments,
} from '../../src/api/staffTickets';
import { mockJsonResponse, stubFetch } from './testHelpers';

const API_BASE_URL = 'http://localhost:4000';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchStaffTickets', () => {
  it('requests the queue with no query string when called with no args', async () => {
    const fetchMock = stubFetch();
    const listResult = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
    fetchMock.mockResolvedValue(mockJsonResponse(listResult));

    const result = await fetchStaffTickets();

    expect(result).toEqual(listResult);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/staff/tickets`, { credentials: 'include' });
  });

  it('serializes status[], itPriority, ownerId, q, page, pageSize, and sort', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ data: [], meta: {} }));

    await fetchStaffTickets({
      status: ['OPEN', 'ASSIGNED'],
      itPriority: 'HIGH',
      ownerId: 'u2',
      q: 'printer',
      page: 2,
      pageSize: 10,
      sort: '-createdAt',
    });

    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(url as string);
    expect(parsed.pathname).toBe('/api/v1/staff/tickets');
    expect(parsed.searchParams.getAll('status')).toEqual(['OPEN', 'ASSIGNED']);
    expect(parsed.searchParams.get('itPriority')).toBe('HIGH');
    expect(parsed.searchParams.get('ownerId')).toBe('u2');
    expect(parsed.searchParams.get('q')).toBe('printer');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('pageSize')).toBe('10');
    expect(parsed.searchParams.get('sort')).toBe('-createdAt');
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Not authorized' } }, 403));

    await expect(fetchStaffTickets()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Not authorized',
      status: 403,
    });
  });
});

describe('fetchAssignableOwners', () => {
  it('GETs the assignable-owners endpoint', async () => {
    const fetchMock = stubFetch();
    const owners = [{ id: 'u2', displayName: 'Bob Staff', role: 'IT_STAFF' }];
    fetchMock.mockResolvedValue(mockJsonResponse(owners));

    const result = await fetchAssignableOwners();

    expect(result).toEqual(owners);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/staff/assignable-owners`, {
      credentials: 'include',
    });
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Not authorized' } }, 403));

    await expect(fetchAssignableOwners()).rejects.toMatchObject({ name: 'ApiError', status: 403 });
  });
});

describe('fetchStaffTicketDetail', () => {
  it('GETs the ticket by id', async () => {
    const fetchMock = stubFetch();
    const detail = { id: 't1' };
    fetchMock.mockResolvedValue(mockJsonResponse(detail));

    const result = await fetchStaffTicketDetail('t1');

    expect(result).toEqual(detail);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/staff/tickets/t1`, { credentials: 'include' });
  });

  it('throws ApiError when the ticket is not found', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Ticket not found' } }, 404));

    await expect(fetchStaffTicketDetail('missing')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Ticket not found',
      status: 404,
    });
  });
});

describe('updateTicketOwner', () => {
  it('PATCHes the owner id', async () => {
    const fetchMock = stubFetch();
    const updated = { id: 't1', owner: { id: 'u2', displayName: 'Bob Staff' } };
    fetchMock.mockResolvedValue(mockJsonResponse(updated));

    const result = await updateTicketOwner('t1', 'u2');

    expect(result).toEqual(updated);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/staff/tickets/t1/owner`);
    expect(init).toMatchObject({ method: 'PATCH', credentials: 'include' });
    expect(JSON.parse(init.body)).toEqual({ ownerId: 'u2' });
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Owner not assignable' } }, 400));

    await expect(updateTicketOwner('t1', 'bad')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Owner not assignable',
      status: 400,
    });
  });
});

describe('updateTicketPriority', () => {
  it('PATCHes the itPriority', async () => {
    const fetchMock = stubFetch();
    const updated = { id: 't1', itPriority: 'URGENT' };
    fetchMock.mockResolvedValue(mockJsonResponse(updated));

    const result = await updateTicketPriority('t1', 'URGENT');

    expect(result).toEqual(updated);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/staff/tickets/t1/priority`);
    expect(init).toMatchObject({ method: 'PATCH', credentials: 'include' });
    expect(JSON.parse(init.body)).toEqual({ itPriority: 'URGENT' });
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Invalid priority' } }, 400));

    await expect(updateTicketPriority('t1', 'BOGUS')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Invalid priority',
      status: 400,
    });
  });
});

describe('updateTicketStatus', () => {
  it('PATCHes the status', async () => {
    const fetchMock = stubFetch();
    const updated = { id: 't1', status: 'RESOLVED' };
    fetchMock.mockResolvedValue(mockJsonResponse(updated));

    const result = await updateTicketStatus('t1', 'RESOLVED');

    expect(result).toEqual(updated);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/staff/tickets/t1/status`);
    expect(init).toMatchObject({ method: 'PATCH', credentials: 'include' });
    expect(JSON.parse(init.body)).toEqual({ status: 'RESOLVED' });
  });

  it('throws ApiError on an invalid transition', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Invalid status transition' } }, 409));

    await expect(updateTicketStatus('t1', 'CLOSED')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Invalid status transition',
      status: 409,
    });
  });
});

describe('fetchStaffComments', () => {
  it('GETs the comment list for a ticket', async () => {
    const fetchMock = stubFetch();
    const list = [{ id: 'c1', body: 'hi' }];
    fetchMock.mockResolvedValue(mockJsonResponse(list));

    const result = await fetchStaffComments('t1');

    expect(result).toEqual(list);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/staff/tickets/t1/comments`, {
      credentials: 'include',
    });
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Ticket not found' } }, 404));

    await expect(fetchStaffComments('missing')).rejects.toMatchObject({ name: 'ApiError', status: 404 });
  });
});

describe('postStaffComment', () => {
  it('POSTs the comment body as JSON', async () => {
    const fetchMock = stubFetch();
    const created = { id: 'c1', body: 'Reached out to the vendor' };
    fetchMock.mockResolvedValue(mockJsonResponse(created, 201));

    const result = await postStaffComment('t1', 'Reached out to the vendor');

    expect(result).toEqual(created);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/staff/tickets/t1/comments`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init.body)).toEqual({ body: 'Reached out to the vendor' });
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Comment body is required' } }, 400));

    await expect(postStaffComment('t1', '')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Comment body is required',
      status: 400,
    });
  });
});

describe('fetchStaffNotes', () => {
  it('GETs the internal-note list for a ticket', async () => {
    const fetchMock = stubFetch();
    const list = [{ id: 'n1', body: 'internal only' }];
    fetchMock.mockResolvedValue(mockJsonResponse(list));

    const result = await fetchStaffNotes('t1');

    expect(result).toEqual(list);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/staff/tickets/t1/notes`, {
      credentials: 'include',
    });
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Ticket not found' } }, 404));

    await expect(fetchStaffNotes('missing')).rejects.toMatchObject({ name: 'ApiError', status: 404 });
  });
});

describe('postStaffNote', () => {
  it('POSTs the note body as JSON', async () => {
    const fetchMock = stubFetch();
    const created = { id: 'n1', body: 'internal only' };
    fetchMock.mockResolvedValue(mockJsonResponse(created, 201));

    const result = await postStaffNote('t1', 'internal only');

    expect(result).toEqual(created);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/staff/tickets/t1/notes`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init.body)).toEqual({ body: 'internal only' });
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Note body is required' } }, 400));

    await expect(postStaffNote('t1', '')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Note body is required',
      status: 400,
    });
  });
});

describe('fetchStaffTicketAttachments', () => {
  it('GETs the attachment list for a ticket', async () => {
    const fetchMock = stubFetch();
    const list = [{ id: 'a1', originalFilename: 'log.txt' }];
    fetchMock.mockResolvedValue(mockJsonResponse(list));

    const result = await fetchStaffTicketAttachments('t1');

    expect(result).toEqual(list);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/staff/tickets/t1/attachments`, {
      credentials: 'include',
    });
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Ticket not found' } }, 404));

    await expect(fetchStaffTicketAttachments('missing')).rejects.toMatchObject({ name: 'ApiError', status: 404 });
  });
});
