import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../../auth/useAuth.js';
import { Icon } from '../ui/Icon.jsx';
import { Button } from '../ui/index.jsx';

export function AppShell({ navigation, portalLabel }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { employee, logout } = useAuth();
  const initials = employee.name
    ? employee.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    : employee.employeeId.slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside
        aria-label="Primary navigation"
        className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}
        id="portal-navigation"
      >
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">B</span>
          <div>
            <strong>Bridge</strong>
            <span>{portalLabel}</span>
          </div>
        </div>
        <nav className="sidebar__nav">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
              end={item.end}
              key={item.to}
              onClick={() => setMenuOpen(false)}
              to={item.to}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <div className="sidebar__identity">
            <span className="avatar">{initials}</span>
            <div>
              <strong>{employee.name || employee.employeeId}</strong>
              <span>{employee.role === 'admin' ? 'Administrator' : employee.title || 'Employee'}</span>
            </div>
          </div>
          <Button icon="logout" onClick={logout} variant="ghost">Sign out</Button>
        </div>
      </aside>

      {menuOpen ? (
        <button
          aria-label="Close navigation"
          className="sidebar-scrim"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      ) : null}

      <div className="app-shell__body">
        <header className="mobile-header">
          <button
            aria-controls="portal-navigation"
            aria-expanded={menuOpen}
            aria-label="Open navigation"
            className="icon-button"
            onClick={() => setMenuOpen(true)}
            type="button"
          >
            <Icon name="menu" />
          </button>
          <span className="mobile-header__brand">Bridge</span>
          <span className="avatar avatar--small">{initials}</span>
        </header>
        <main className="main-content" id="main-content" tabIndex="-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
