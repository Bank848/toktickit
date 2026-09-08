import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchHealth, fetchCategories } from '../../src/api';
import { mockJsonResponse, stubFetch } from './testHelpers';

const API_BASE_URL = 'http://localhost:4000';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchHealth', () => {
  it('GETs the health endpoint and returns the parsed body', async () => {
    const fetchMock = stubFetch();
    const health = { status: 'ok', service: 'toktickit-api' };
    fetchMock.mockResolvedValue(mockJsonResponse(health));

    const result = await fetchHealth();

    expect(result).toEqual(health);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/health`);
  });

  it('throws a plain Error on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({}, 500));

    await expect(fetchHealth()).rejects.toThrow('Backend health check failed');
  });
});

describe('fetchCategories', () => {
  it('GETs the categories endpoint and returns the parsed body', async () => {
    const fetchMock = stubFetch();
    const categories = [{ id: 1, name: 'Hardware' }];
    fetchMock.mockResolvedValue(mockJsonResponse(categories));

    const result = await fetchCategories();

    expect(result).toEqual(categories);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/categories`);
  });

  it('throws a plain Error on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({}, 500));

    await expect(fetchCategories()).rejects.toThrow('Failed to load categories');
  });
});
