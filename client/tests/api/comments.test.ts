import { describe, it, expect } from 'vitest';
import { fetchComments, postComment } from '../../src/api/comments';
import { API_BASE_URL, mockJsonResponse, resetFetchAfterEach, stubFetch } from './testHelpers';

resetFetchAfterEach();

describe('fetchComments', () => {
  it('GETs the comment list for a ticket', async () => {
    const fetchMock = stubFetch();
    const list = [{ id: 'c1', body: 'hi' }];
    fetchMock.mockResolvedValue(mockJsonResponse(list));

    const result = await fetchComments('t1');

    expect(result).toEqual(list);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/tickets/t1/comments`, {
      credentials: 'include',
    });
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Ticket not found' } }, 404));

    await expect(fetchComments('missing')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Ticket not found',
      status: 404,
    });
  });
});

describe('postComment', () => {
  it('POSTs the payload as JSON and returns the created comment', async () => {
    const fetchMock = stubFetch();
    const created = { id: 'c1', body: 'It still fails' };
    fetchMock.mockResolvedValue(mockJsonResponse(created, 201));

    const payload = { body: 'It still fails', problemAppearsResolved: false };
    const result = await postComment('t1', payload);

    expect(result).toEqual(created);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/tickets/t1/comments`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it('throws ApiError with the server message on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(
      mockJsonResponse({ error: { message: 'Comment body is required', fieldErrors: [{ field: 'body', message: 'Required' }] } }, 400),
    );

    await expect(postComment('t1', { body: '' })).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Comment body is required',
      status: 400,
      fieldErrors: [{ field: 'body', message: 'Required' }],
    });
  });
});
