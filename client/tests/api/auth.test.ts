import { describe, it, expect } from 'vitest';
import { login, logout, fetchMe, changePassword, LoginRequestError, ChangePasswordRequestError } from '../../src/api/auth';
import { API_BASE_URL, mockJsonResponse, resetFetchAfterEach, stubFetch } from './testHelpers';

resetFetchAfterEach();

const CURRENT_USER = {
  id: 'u1',
  email: 'alice@toktickit.local',
  displayName: 'Alice Admin',
  role: 'ADMINISTRATOR' as const,
  mustChangePassword: false,
};

describe('login', () => {
  it('POSTs email/password as JSON and returns the current user', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse(CURRENT_USER));

    const result = await login('alice@toktickit.local', 'Str0ng!Pass');

    expect(result).toEqual(CURRENT_USER);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/auth/login`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init.body)).toEqual({ email: 'alice@toktickit.local', password: 'Str0ng!Pass' });
  });

  it('throws a LoginRequestError with the server error code on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { code: 'INVALID_CREDENTIALS' } }, 401));

    await expect(login('alice@toktickit.local', 'wrong')).rejects.toMatchObject(
      new LoginRequestError('INVALID_CREDENTIALS'),
    );
  });

  it('falls back to UNKNOWN_ERROR when the error body has no code', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({}, 500));

    await expect(login('alice@toktickit.local', 'x')).rejects.toMatchObject(new LoginRequestError('UNKNOWN_ERROR'));
  });
});

describe('logout', () => {
  it('POSTs to the logout endpoint', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({}));

    await logout();

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  });
});

describe('fetchMe', () => {
  it('GETs the current user', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse(CURRENT_USER));

    const result = await fetchMe();

    expect(result).toEqual(CURRENT_USER);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/me`, { credentials: 'include' });
  });

  it('throws a plain Error when not authenticated', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({}, 401));

    await expect(fetchMe()).rejects.toThrow('Not authenticated');
  });
});

describe('changePassword', () => {
  it('POSTs the input as JSON and returns the updated current user', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse(CURRENT_USER));

    const input = { currentPassword: 'old', newPassword: 'NewStr0ng!', confirmNewPassword: 'NewStr0ng!' };
    const result = await changePassword(input);

    expect(result).toEqual(CURRENT_USER);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/auth/change-password`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init.body)).toEqual(input);
  });

  it('throws a ChangePasswordRequestError with code and fieldErrors on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(
      mockJsonResponse(
        { error: { code: 'PASSWORD_MISMATCH', fieldErrors: [{ field: 'confirmNewPassword', message: 'Must match' }] } },
        400,
      ),
    );

    await expect(
      changePassword({ currentPassword: 'old', newPassword: 'a', confirmNewPassword: 'b' }),
    ).rejects.toMatchObject(
      new ChangePasswordRequestError('PASSWORD_MISMATCH', [{ field: 'confirmNewPassword', message: 'Must match' }]),
    );
  });
});
