import { Navigate, Route, Routes } from 'react-router-dom';

import { GuestOnly, RequireAuth, RoleHome } from './auth/RouteGuards.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import AdminEmployees from './features/admin/AdminEmployees.jsx';
import AdminIntegrations from './features/admin/AdminIntegrations.jsx';
import AdminOverview from './features/admin/AdminOverview.jsx';
import AdminRequests from './features/admin/AdminRequests.jsx';
import AdminSettings from './features/admin/AdminSettings.jsx';
import AdminTemplates from './features/admin/AdminTemplates.jsx';
import ForgotPassword from './features/auth/ForgotPassword.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import ResetPassword from './features/auth/ResetPassword.jsx';
import EmployeeHistory from './features/employee/EmployeeHistory.jsx';
import EmployeeOverview from './features/employee/EmployeeOverview.jsx';
import EmployeeProfile from './features/employee/EmployeeProfile.jsx';
import NewRequest from './features/employee/NewRequest.jsx';
import NotFound from './features/shared/NotFound.jsx';

const employeeNavigation = [
  { to: '/employee', label: 'Overview', icon: 'overview', end: true },
  { to: '/employee/request', label: 'New request', icon: 'request' },
  { to: '/employee/history', label: 'Request history', icon: 'history' },
  { to: '/employee/profile', label: 'Profile & security', icon: 'profile' },
];

const adminNavigation = [
  { to: '/admin', label: 'Overview', icon: 'overview', end: true },
  { to: '/admin/requests', label: 'Letter requests', icon: 'history' },
  { to: '/admin/employees', label: 'Employees', icon: 'people' },
  { to: '/admin/templates', label: 'Templates', icon: 'template' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
  { to: '/admin/integrations', label: 'Integrations', icon: 'integration' },
];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleHome />} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/reset-password" element={<GuestOnly><ResetPassword /></GuestOnly>} />

      <Route element={<RequireAuth role="user" />}>
        <Route element={<AppShell navigation={employeeNavigation} portalLabel="Employee portal" />} path="/employee">
          <Route index element={<EmployeeOverview />} />
          <Route path="request" element={<NewRequest />} />
          <Route path="history" element={<EmployeeHistory />} />
          <Route path="profile" element={<EmployeeProfile />} />
        </Route>
      </Route>

      <Route element={<RequireAuth role="admin" />}>
        <Route element={<AppShell navigation={adminNavigation} portalLabel="Admin workspace" />} path="/admin">
          <Route index element={<AdminOverview />} />
          <Route path="requests" element={<AdminRequests />} />
          <Route path="employees" element={<AdminEmployees />} />
          <Route path="templates" element={<AdminTemplates />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="integrations" element={<AdminIntegrations />} />
        </Route>
      </Route>

      <Route element={<Navigate replace to="/employee" />} path="/dashboard" />
      <Route element={<Navigate replace to="/admin" />} path="/admin-dashboard" />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
