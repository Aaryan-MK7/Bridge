import { useCallback, useEffect, useMemo, useState } from 'react';

import { authApi } from '../api/resources.js';
import {
  clearStoredSession,
  loadStoredSession,
  setAccessToken,
  storeSession,
  subscribeToUnauthorized,
} from '../api/client.js';
import { parseLoginResponse, sanitizeEmployee } from '../lib/contracts.js';
import { AuthContext } from './useAuth.js';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadStoredSession());

  useEffect(() => {
    setAccessToken(session?.token);
  }, [session?.token]);

  const logout = useCallback(() => {
    clearStoredSession();
    setSession(null);
  }, []);

  useEffect(() => subscribeToUnauthorized(logout), [logout]);

  const login = useCallback(async (credentials) => {
    const response = await authApi.login(credentials);
    const nextSession = parseLoginResponse(response);
    storeSession(nextSession);
    setSession(nextSession);
    return nextSession.employee;
  }, []);

  const updateEmployee = useCallback((employee) => {
    setSession((current) => {
      if (!current) return current;
      const safeEmployee = sanitizeEmployee({ ...current.employee, ...employee });
      const nextSession = { ...current, employee: safeEmployee };
      storeSession(nextSession);
      return nextSession;
    });
  }, []);

  const value = useMemo(() => ({
    employee: session?.employee || null,
    isAuthenticated: Boolean(session?.token && session?.employee),
    login,
    logout,
    updateEmployee,
  }), [login, logout, session, updateEmployee]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
