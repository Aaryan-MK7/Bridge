import { useEffect, useState } from 'react';

import { settingsApi } from '../../api/resources.js';
import { Alert, Button, Card, Field, LoadingState, PageHeader } from '../../components/ui/index.jsx';

const blankSettings = {
  host: '',
  port: 587,
  user: '',
  pass: '',
  from: '',
  adminEmail: '',
};

export default function AdminSettings() {
  const [settings, setSettings] = useState(blankSettings);
  const [state, setState] = useState({ loading: true, saving: false, error: '', success: '' });

  useEffect(() => {
    settingsApi.getSmtp()
      .then((data) => setSettings({
        ...blankSettings,
        host: data.host || '',
        port: data.port || 587,
        user: data.user || '',
        from: data.from || '',
        adminEmail: data.adminEmail || '',
      }))
      .catch((error) => setState((current) => ({ ...current, error: error.message })))
      .finally(() => setState((current) => ({ ...current, loading: false })));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setState({ loading: false, saving: true, error: '', success: '' });
    try {
      const payload = {
        host: settings.host.trim(),
        port: Number(settings.port),
        user: settings.user.trim(),
        from: settings.from.trim(),
        adminEmail: settings.adminEmail.trim(),
      };
      if (settings.pass) payload.pass = settings.pass;
      await settingsApi.updateSmtp(payload);
      setSettings((current) => ({ ...current, pass: '' }));
      setState({ loading: false, saving: false, error: '', success: 'Email settings saved.' });
    } catch (error) {
      setState({ loading: false, saving: false, error: error.message, success: '' });
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        description="Configure optional delivery services without exposing stored credentials."
        eyebrow="Administration"
        title="Settings"
      />

      {state.loading ? <LoadingState label="Loading settings" /> : (
        <div className="content-grid content-grid--settings">
          <Card className="content-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Email delivery</p>
                <h2>SMTP configuration</h2>
                <p>Used for request and decision notifications.</p>
              </div>
            </div>
            {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
            {state.success ? <Alert variant="success">{state.success}</Alert> : null}
            <form className="form-grid" onSubmit={handleSubmit}>
              <Field
                label="SMTP host"
                name="smtp-host"
                onChange={(event) => setSettings((current) => ({ ...current, host: event.target.value }))}
                required
                value={settings.host}
              />
              <Field
                label="Port"
                name="smtp-port"
                onChange={(event) => setSettings((current) => ({ ...current, port: event.target.value }))}
                required
                type="number"
                value={settings.port}
              />
              <Field
                label="Username"
                name="smtp-user"
                onChange={(event) => setSettings((current) => ({ ...current, user: event.target.value }))}
                value={settings.user}
              />
              <Field
                hint="Leave blank to retain the stored credential."
                label="Password"
                name="smtp-password"
                onChange={(event) => setSettings((current) => ({ ...current, pass: event.target.value }))}
                type="password"
                value={settings.pass}
              />
              <Field
                label="From address"
                name="smtp-from"
                onChange={(event) => setSettings((current) => ({ ...current, from: event.target.value }))}
                placeholder="HR Letters <letters@example.com>"
                value={settings.from}
              />
              <Field
                label="Fallback admin email"
                name="smtp-admin-email"
                onChange={(event) => setSettings((current) => ({ ...current, adminEmail: event.target.value }))}
                type="email"
                value={settings.adminEmail}
              />
              <div className="form-actions form-grid__full">
                <Button loading={state.saving} type="submit">Save settings</Button>
              </div>
            </form>
          </Card>

          <Card className="content-card security-note">
            <span className="empty-state__icon" aria-hidden="true">✓</span>
            <h2>Credential-safe by design</h2>
            <p>
              Bridge never displays the saved SMTP password. Enter a value only when you need
              to replace the existing credential.
            </p>
            <ul>
              <li>Use a dedicated service account.</li>
              <li>Rotate credentials on your normal security schedule.</li>
              <li>Keep optional email failures separate from request processing.</li>
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
