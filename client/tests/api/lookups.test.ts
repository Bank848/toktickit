import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchCategories, fetchRelatedSystems } from '../../src/api/lookups';
import { mockJsonResponse, stubFetch } from './testHelpers';

const API_BASE_URL = 'http://localhost:4000';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCategories', () => {
  it('GETs the categories endpoint and returns the parsed body', async () => {
    const fetchMock = stubFetch();
    const categories = [{ id: 1, name: 'Hardware' }];
    fetchMock.mockResolvedValue(mockJsonResponse(categories));

    const result = await fetchCategories();

    expect(result).toEqual(categories);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/categories`, { credentials: 'include' });
  });

  it('throws a plain Error on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({}, 500));

    await expect(fetchCategories()).rejects.toThrow('Failed to load categories');
  });
});

describe('fetchRelatedSystems', () => {
  it('GETs the related-systems endpoint and returns the parsed body', async () => {
    const fetchMock = stubFetch();
    const systems = [{ id: 1, code: 'ERP', name: 'Enterprise Resource Planning' }];
    fetchMock.mockResolvedValue(mockJsonResponse(systems));

    const result = await fetchRelatedSystems();

    expect(result).toEqual(systems);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/related-systems`, { credentials: 'include' });
  });

  it('throws a plain Error on a non-2xx response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(mockJsonResponse({}, 500));

    await expect(fetchRelatedSystems()).rejects.toThrow('Failed to load related systems');
  });
});
