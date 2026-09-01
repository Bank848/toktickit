import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface SelectedRequester {
  id: string;
  email: string;
  displayName: string;
}

const STORAGE_KEY = 'toktickit.selectedRequesterId';

interface RequesterContextValue {
  requester: SelectedRequester | null;
  setRequester: (requester: SelectedRequester) => void;
  clearRequester: () => void;
}

const RequesterContext = createContext<RequesterContextValue | undefined>(undefined);

function readStored(): SelectedRequester | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SelectedRequester;
  } catch {
    return null;
  }
}

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requester, setRequesterState] = useState<SelectedRequester | null>(readStored);

  const setRequester = useCallback((next: SelectedRequester) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setRequesterState(next);
  }, []);

  const clearRequester = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setRequesterState(null);
  }, []);

  return (
    <RequesterContext.Provider value={{ requester, setRequester, clearRequester }}>
      {children}
    </RequesterContext.Provider>
  );
}

export function useRequester(): RequesterContextValue {
  const ctx = useContext(RequesterContext);
  if (!ctx) throw new Error('useRequester must be used within a RequesterProvider');
  return ctx;
}
