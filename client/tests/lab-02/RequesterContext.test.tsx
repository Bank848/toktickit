import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { RequesterProvider, useRequester } from '../../src/context/RequesterContext';

const STORAGE_KEY = 'toktickit.selectedRequesterId';

function wrapper({ children }: { children: React.ReactNode }) {
  return <RequesterProvider>{children}</RequesterProvider>;
}

describe('RequesterContext', () => {
  beforeEach(() => sessionStorage.clear());

  it('starts with no requester when sessionStorage is empty', () => {
    const { result } = renderHook(() => useRequester(), { wrapper });
    expect(result.current.requester).toBeNull();
  });

  it('restores a previously selected requester from sessionStorage on mount', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'u1', email: 'a@b.test', displayName: 'Ariya' }));
    const { result } = renderHook(() => useRequester(), { wrapper });
    expect(result.current.requester?.id).toBe('u1');
  });

  it('setRequester persists to sessionStorage', () => {
    const { result } = renderHook(() => useRequester(), { wrapper });
    act(() => result.current.setRequester({ id: 'u2', email: 'c@d.test', displayName: 'Narin' }));
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY)!).id).toBe('u2');
    expect(result.current.requester?.id).toBe('u2');
  });

  it('clearRequester removes sessionStorage and resets state', () => {
    const { result } = renderHook(() => useRequester(), { wrapper });
    act(() => result.current.setRequester({ id: 'u2', email: 'c@d.test', displayName: 'Narin' }));
    act(() => result.current.clearRequester());
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.requester).toBeNull();
  });
});
