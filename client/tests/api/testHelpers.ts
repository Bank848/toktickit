import { vi } from 'vitest';

/**
 * Builds a minimal fake `Response` for mocking `fetch` in API client unit tests.
 * Only the members these API modules actually touch (`ok`, `status`, `json`) are implemented.
 */
export function mockJsonResponse(body: unknown, status = 200): Response {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

/** Installs a `vi.fn()` on `global.fetch` and returns it for call assertions. */
export function stubFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
