import { afterEach, vi } from 'vitest';

/** Matches every `client/src/api/*.ts` module's `VITE_API_BASE_URL` fallback. */
export const API_BASE_URL = 'http://localhost:4000';

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

/** Call once at module scope in a test file that uses stubFetch(), to undo the stub after each test. */
export function resetFetchAfterEach(): void {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
}
