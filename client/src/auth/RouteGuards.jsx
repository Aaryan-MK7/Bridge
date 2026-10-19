import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './useAuth.js';

export function RequireAuth({ role }) {
  const { employee, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role && employee.role !== role) {
    return <Navigate to={employee.role === 'admin' ? '/admin' : '/employee'} replace />;
  }

  return <Outlet />;
}

export function GuestOnly({ children }) {
  const { employee, isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to={employee.role === 'admin' ? '/admin' : '/employee'} replace />;
  }
  return children;
}

export function RoleHome() {
  const { employee, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={employee.role === 'admin' ? '/admin' : '/employee'} replace />;
}
