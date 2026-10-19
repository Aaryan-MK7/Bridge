import { useState } from 'react';
import { Link } from 'react-router-dom';

import { authApi } from '../../api/resources.js';
import { Alert, Button, Field } from '../../components/ui/index.jsx';
import AuthLayout from './AuthLayout.jsx';

export default function ForgotPassword() {
  const [form, setForm] = useState({ employeeId: '', email: '' });
  const [status, setStatus] = useState({ loading: false, error: '', sent: false });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: '', sent: false });
    try {
      await authApi.forgotPassword({
        employeeId: form.employeeId.trim(),
        email: form.email.trim(),
      });
      setStatus({ loading: false, error: '', sent: true });
    } catch (error) {
      setStatus({ loading: false, error: error.message, sent: false });
    }
  };

  return (
    <AuthLayout
      description="We will send reset instructions if the information matches an account."
      eyebrow="Account recovery"
      title="Reset your password"
    >
      {status.sent ? (
        <div className="auth-form">
          <Alert title="Check your inbox" variant="success">
            If the details match an account, password reset instructions are on their way.
          </Alert>
          <Link className="button button--primary button--full" to="/login">Return to sign in</Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          {status.error ? <Alert variant="danger">{status.error}</Alert> : null}
          <Field
            autoComplete="username"
            label="Employee ID"
            name="employeeId"
            onChange={(event) => setForm((current) => ({
              ...current,
              employeeId: event.target.value,
            }))}
            required
            value={form.employeeId}
          />
          <Field
            autoComplete="email"
            label="Work email"
            name="email"
            onChange={(event) => setForm((current) => ({
              ...current,
              email: event.target.value,
            }))}
            required
            type="email"
            value={form.email}
          />
          <Button className="button--full" loading={status.loading} type="submit">
            Send reset instructions
          </Button>
          <Link className="auth-back-link" to="/login">Back to sign in</Link>
        </form>
      )}
    </AuthLayout>
  );
}
