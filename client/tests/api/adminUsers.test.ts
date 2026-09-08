import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchUsers, createUser, updateUser, setInitialPassword, ApiError } from '../../src/api/adminUsers';
import { mockJsonResponse, stubFetch } from './testHelpers';

const API_BASE_URL = 'http://localhost:4000';

afterEach(() => {
  vi.unstubAllGlobals();
});

const USER = {
  id: 'u1',
  displayName: 'Alice Admin',
  email: 'alice@toktickit.local',
  role: 'ADMINISTRATOR' as const,
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('fetchUsers', () => {
  it('requests the collection with an empty query string when no filters are given', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse([USER]));

    const result = await fetchUsers({});

    expect(result).toEqual([USER]);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/admin/users?`, { credentials: 'include' });
  });

  it('serializes q and role into the query string', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse([]));

    await fetchUsers({ q: 'bob', role: 'IT_STAFF' });

    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(url as string);
    expect(parsed.searchParams.get('q')).toBe('bob');
    expect(parsed.searchParams.get('role')).toBe('IT_STAFF');
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Not authorized' } }, 403));

    await expect(fetchUsers({})).rejects.toMatchObject({ name: 'ApiError', message: 'Not authorized', status: 403 });
  });
});

describe('createUser', () => {
  it('POSTs the payload as JSON and returns the created user', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse(USER, 201));

    const payload = {
      displayName: 'Alice Admin',
      email: 'alice@toktickit.local',
      role: 'ADMINISTRATOR' as const,
      isActive: true,
      initialPassword: 'Str0ng!Pass',
    };
    const result = await createUser(payload);

    expect(result).toEqual(USER);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/admin/users`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it('throws ApiError with default message/status/fieldErrors when the body is empty', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse(null, 409));

    await expect(
      createUser({
        displayName: 'Dup',
        email: 'alice@toktickit.local',
        role: 'REQUESTER',
        isActive: true,
        initialPassword: 'Str0ng!Pass',
      }),
    ).rejects.toMatchObject(new ApiError('Request failed', 409, []));
  });
});

describe('updateUser', () => {
  it('PATCHes the payload as JSON and returns the updated user', async () => {
    const fetchMock = stubFetch();
    const updated = { ...USER, displayName: 'Alice A.' };
    fetchMock.mockResolvedValue(mockJsonResponse(updated));

    const payload = { displayName: 'Alice A.', email: USER.email, role: USER.role, isActive: true };
    const result = await updateUser('u1', payload);

    expect(result).toEqual(updated);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/admin/users/u1`);
    expect(init).toMatchObject({ method: 'PATCH', credentials: 'include' });
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'Email already in use' } }, 409));

    await expect(
      updateUser('u1', { displayName: 'x', email: 'dupe@toktickit.local', role: 'REQUESTER', isActive: true }),
    ).rejects.toMatchObject({ name: 'ApiError', message: 'Email already in use', status: 409 });
  });
});

describe('setInitialPassword', () => {
  it('PATCHes newInitialPassword and returns the updated user', async () => {
    const fetchMock = stubFetch();
    const updated = { ...USER, mustChangePassword: true };
    fetchMock.mockResolvedValue(mockJsonResponse(updated));

    const result = await setInitialPassword('u1', 'NewInit!Pass1');

    expect(result).toEqual(updated);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/admin/users/u1/password`);
    expect(init).toMatchObject({ method: 'PATCH', credentials: 'include' });
    expect(JSON.parse(init.body)).toEqual({ newInitialPassword: 'NewInit!Pass1' });
  });

  it('throws ApiError on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: 'User not found' } }, 404));

    await expect(setInitialPassword('missing', 'x')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'User not found',
      status: 404,
    });
  });
});
