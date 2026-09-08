import { describe, it, expect, afterEach, vi } from 'vitest';
import { uploadAttachment, fetchAttachments, removeAttachment } from '../../src/api/attachments';
import { mockJsonResponse, stubFetch } from './testHelpers';

const API_BASE_URL = 'http://localhost:4000';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadAttachment', () => {
  it('POSTs the file as multipart form data and returns the created attachment', async () => {
    const fetchMock = stubFetch();
    const created = { id: 'a1', originalFilename: 'log.txt' };
    fetchMock.mockResolvedValue(mockJsonResponse(created, 201));

    const file = new File(['hello'], 'log.txt', { type: 'text/plain' });
    const result = await uploadAttachment('t1', file);

    expect(result).toEqual(created);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/tickets/t1/attachments`);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBe(file);
  });

  it('throws ApiError using the filename in the fallback message on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({}, 413));

    const file = new File(['x'], 'huge.bin');

    await expect(uploadAttachment('t1', file)).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Failed to upload huge.bin',
      status: 413,
    });
  });

  it('surfaces the server error message when present', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Unsupported file type' } }, 415));

    const file = new File(['x'], 'virus.exe');

    await expect(uploadAttachment('t1', file)).rejects.toMatchObject({
      message: 'Unsupported file type',
      status: 415,
    });
  });
});

describe('fetchAttachments', () => {
  it('GETs the attachment list for a ticket', async () => {
    const fetchMock = stubFetch();
    const list = [{ id: 'a1' }];
    fetchMock.mockResolvedValue(mockJsonResponse(list));

    const result = await fetchAttachments('t1');

    expect(result).toEqual(list);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/tickets/t1/attachments`, {
      credentials: 'include',
    });
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Ticket not found' } }, 404));

    await expect(fetchAttachments('missing')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Ticket not found',
      status: 404,
    });
  });
});

describe('removeAttachment', () => {
  it('DELETEs the attachment with a JSON reason body', async () => {
    const fetchMock = stubFetch();
    const removed = { id: 'a1', status: 'REMOVED' };
    fetchMock.mockResolvedValue(mockJsonResponse(removed));

    const result = await removeAttachment('a1', 'Uploaded by mistake');

    expect(result).toEqual(removed);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/attachments/a1`);
    expect(init).toMatchObject({
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init.body)).toEqual({ reason: 'Uploaded by mistake' });
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Not permitted' } }, 403));

    await expect(removeAttachment('a1', 'reason')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Not permitted',
      status: 403,
    });
  });
});
