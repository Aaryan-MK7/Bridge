import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/useAuth.js';
import { Alert, Button, Field } from '../../components/ui/index.jsx';
import AuthLayout from './AuthLayout.jsx';

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ employeeId: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoRole, setDemoRole] = useState('');
  const { demoLogin, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const completeLogin = (employee) => {
    const requestedPath = location.state?.from?.pathname;
    const roleHome = employee.role === 'admin' ? '/admin' : '/employee';
    navigate(requestedPath || roleHome, { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const employee = await login({
        employeeId: credentials.employeeId.trim(),
        password: credentials.password,
      });
      completeLogin(employee);
    } catch (submitError) {
      setError(submitError.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const handleDemoLogin = async (role) => {
    setError('');
    setDemoRole(role);
    try {
      completeLogin(await demoLogin(role));
    } catch (submitError) {
      setError(submitError.message || 'Unable to open the demo. Please try again.');
    } finally {
      setDemoRole('');
    }
  };

  return (
    <AuthLayout
      description="Use your employee credentials to continue."
      eyebrow="Welcome back"
      title="Sign in to Bridge"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {location.state?.notice ? <Alert variant="success">{location.state.notice}</Alert> : null}
        {error ? <Alert variant="danger">{error}</Alert> : null}
        <Field
          autoComplete="username"
          label="Employee ID"
          name="employeeId"
          onChange={(event) => setCredentials((current) => ({
            ...current,
            employeeId: event.target.value,
          }))}
          placeholder="e.g. ABC0013"
          required
          value={credentials.employeeId}
        />
        <Field
          autoComplete="current-password"
          label="Password"
          name="password"
          onChange={(event) => setCredentials((current) => ({
            ...current,
            password: event.target.value,
          }))}
          required
          type="password"
          value={credentials.password}
        />
        <div className="auth-form__meta">
          <span>Credentials are managed by HR.</span>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <Button
          className="button--full"
          disabled={Boolean(demoRole)}
          loading={loading}
          type="submit"
        >
          Sign in
        </Button>
        <div className="auth-divider"><span>or explore the shared demo</span></div>
        <div className="auth-demo-actions">
          <Button
            disabled={loading || Boolean(demoRole)}
            loading={demoRole === 'user'}
            onClick={() => handleDemoLogin('user')}
            variant="secondary"
          >
            View as employee
          </Button>
          <Button
            disabled={Boolean(demoRole)}
            loading={demoRole === 'admin'}
            onClick={() => handleDemoLogin('admin')}
            variant="secondary"
          >
            View as administrator
          </Button>
        </div>
      </form>
      <p className="auth-help">Demo accounts use shared seeded data and protected profiles.</p>
    </AuthLayout>
  );
}
