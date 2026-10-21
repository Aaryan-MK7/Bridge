import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/useAuth.js';
import { Alert, Button, Field } from '../../components/ui/index.jsx';
import AuthLayout from './AuthLayout.jsx';

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ employeeId: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const employee = await login({
        employeeId: credentials.employeeId.trim(),
        password: credentials.password,
      });
      const requestedPath = location.state?.from?.pathname;
      const roleHome = employee.role === 'admin' ? '/admin' : '/employee';
      navigate(requestedPath || roleHome, { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
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
        <Button className="button--full" loading={loading} type="submit">Sign in</Button>
      </form>
      <p className="auth-help">Need access? Contact your HR administrator.</p>
    </AuthLayout>
  );
}
