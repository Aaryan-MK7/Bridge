import { useCallback, useEffect, useMemo, useState } from 'react';

import { authApi, employeeApi } from '../api/resources.js';
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

  const establishSession = useCallback((response) => {
    const nextSession = parseLoginResponse(response);
    storeSession(nextSession);
    setSession(nextSession);
    return nextSession.employee;
  }, []);

  const login = useCallback(async (credentials) => (
    establishSession(await authApi.login(credentials))
  ), [establishSession]);

  const demoLogin = useCallback(async (role) => (
    establishSession(await authApi.demoLogin(role))
  ), [establishSession]);

  const updateEmployee = useCallback((employee) => {
    setSession((current) => {
      if (!current) return current;
      const safeEmployee = sanitizeEmployee({ ...current.employee, ...employee });
      const nextSession = { ...current, employee: safeEmployee };
      storeSession(nextSession);
      return nextSession;
    });
  }, []);

  useEffect(() => {
    if (!session?.token || !session.employee?.employeeId) return;
    employeeApi.getProfile(session.employee.employeeId)
      .then(updateEmployee)
      .catch(() => {
        // Authenticated 401 responses are handled by the shared API client.
      });
  }, [session?.employee?.employeeId, session?.token, updateEmployee]);

  const value = useMemo(() => ({
    employee: session?.employee || null,
    isAuthenticated: Boolean(session?.token && session?.employee),
    demoLogin,
    login,
    logout,
    updateEmployee,
  }), [demoLogin, login, logout, session, updateEmployee]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
