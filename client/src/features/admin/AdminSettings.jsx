import { useEffect, useState } from 'react';

import { settingsApi } from '../../api/resources.js';
import { Alert, Button, Card, Field, LoadingState, PageHeader } from '../../components/ui/index.jsx';

const blankSettings = {
  adminEmail: '',
  delivery: {
    serviceId: false,
    templateId: false,
    publicKey: false,
    fullyConfigured: false,
  },
};

export default function AdminSettings() {
  const [settings, setSettings] = useState(blankSettings);
  const [state, setState] = useState({
    loading: true,
    saving: false,
    error: '',
    success: '',
  });

  useEffect(() => {
    settingsApi.getNotifications()
      .then((data) => setSettings({
        ...blankSettings,
        adminEmail: data.adminEmail || '',
        delivery: { ...blankSettings.delivery, ...data.delivery },
      }))
      .catch((error) => setState((current) => ({ ...current, error: error.message })))
      .finally(() => setState((current) => ({ ...current, loading: false })));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setState({ loading: false, saving: true, error: '', success: '' });
    try {
      const result = await settingsApi.updateNotifications({
        adminEmail: settings.adminEmail.trim(),
      });
      setSettings((current) => ({ ...current, ...result }));
      setState({
        loading: false,
        saving: false,
        error: '',
        success: 'Notification settings saved.',
      });
    } catch (error) {
      setState({ loading: false, saving: false, error: error.message, success: '' });
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        description="Choose where operational alerts are delivered and review email readiness."
        eyebrow="Administration"
        title="Settings"
      />

      {state.loading ? <LoadingState label="Loading settings" /> : (
        <div className="content-grid content-grid--settings">
          <Card className="content-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Operations</p>
                <h2>Request notifications</h2>
                <p>New request alerts are sent here when EmailJS is configured.</p>
              </div>
            </div>
            {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
            {state.success ? <Alert variant="success">{state.success}</Alert> : null}
            <form className="form-grid" onSubmit={handleSubmit}>
              <Field
                label="Operations notification email"
                name="notification-admin-email"
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  adminEmail: event.target.value,
                }))}
                placeholder="hr@example.com"
                type="email"
                value={settings.adminEmail}
              />
              <div className="form-actions form-grid__full">
                <Button loading={state.saving} type="submit">Save settings</Button>
              </div>
            </form>
          </Card>

          <Card className="content-card security-note">
            <span className="empty-state__icon" aria-hidden="true">
              {settings.delivery.fullyConfigured ? '✓' : '!'}
            </span>
            <h2>
              {settings.delivery.fullyConfigured
                ? 'Email delivery is ready'
                : 'Email delivery needs configuration'}
            </h2>
            <p>
              EmailJS credentials are read from server environment variables and are never
              stored or returned by this screen.
            </p>
            <ul>
              <li>Service ID: {settings.delivery.serviceId ? 'configured' : 'missing'}</li>
              <li>Template ID: {settings.delivery.templateId ? 'configured' : 'missing'}</li>
              <li>Public key: {settings.delivery.publicKey ? 'configured' : 'missing'}</li>
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
