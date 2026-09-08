import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { fetchMe, logout as logoutRequest, type CurrentUser } from '../api/auth';

interface AuthContextValue {
  currentUser: CurrentUser | null;
  isLoading: boolean;
  setCurrentUser: (user: CurrentUser) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The session lives only in an httpOnly cookie the client can't read directly, so identity
  // is hydrated by asking the server on mount rather than restoring anything from storage.
  useEffect(() => {
    fetchMe()
      .then(setCurrentUserState)
      .catch(() => setCurrentUserState(null))
      .finally(() => setIsLoading(false));
  }, []);

  const setCurrentUser = useCallback((user: CurrentUser) => {
    setCurrentUserState(user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setCurrentUserState(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, setCurrentUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
