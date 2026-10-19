import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { authApi } from '../../api/resources.js';
import { Alert, Button, Field } from '../../components/ui/index.jsx';
import AuthLayout from './AuthLayout.jsx';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const employeeId = searchParams.get('employeeId') || '';
  const [form, setForm] = useState({ password: '', confirmation: '' });
  const [status, setStatus] = useState({ loading: false, error: '', complete: false });
  const validLink = Boolean(token && employeeId);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.password.length < 8) {
      setStatus({ loading: false, error: 'Use at least 8 characters.', complete: false });
      return;
    }
    if (form.password !== form.confirmation) {
      setStatus({ loading: false, error: 'Passwords do not match.', complete: false });
      return;
    }

    setStatus({ loading: true, error: '', complete: false });
    try {
      await authApi.resetPassword({
        employeeId,
        resetToken: token,
        newPassword: form.password,
      });
      setStatus({ loading: false, error: '', complete: true });
    } catch (error) {
      setStatus({ loading: false, error: error.message, complete: false });
    }
  };

  return (
    <AuthLayout
      description="Choose a unique password you do not use elsewhere."
      eyebrow="Account security"
      title="Create a new password"
    >
      {!validLink ? (
        <div className="auth-form">
          <Alert title="This reset link is invalid" variant="danger">
            Request a new link to continue.
          </Alert>
          <Link className="button button--primary button--full" to="/forgot-password">
            Request a new link
          </Link>
        </div>
      ) : status.complete ? (
        <div className="auth-form">
          <Alert title="Password updated" variant="success">
            Your new password is ready to use.
          </Alert>
          <Link className="button button--primary button--full" to="/login">Sign in</Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          {status.error ? <Alert variant="danger">{status.error}</Alert> : null}
          <Field
            autoComplete="new-password"
            hint="At least 8 characters"
            label="New password"
            name="new-password"
            onChange={(event) => setForm((current) => ({
              ...current,
              password: event.target.value,
            }))}
            required
            type="password"
            value={form.password}
          />
          <Field
            autoComplete="new-password"
            label="Confirm new password"
            name="confirm-password"
            onChange={(event) => setForm((current) => ({
              ...current,
              confirmation: event.target.value,
            }))}
            required
            type="password"
            value={form.confirmation}
          />
          <Button className="button--full" loading={status.loading} type="submit">
            Update password
          </Button>
          <Link className="auth-back-link" to="/login">Back to sign in</Link>
        </form>
      )}
    </AuthLayout>
  );
}
