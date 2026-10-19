import { useCallback, useEffect, useState } from 'react';

import { docusignApi } from '../../api/resources.js';
import {
  Alert,
  Button,
  Card,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../components/ui/index.jsx';
import { formatDate } from '../../lib/format.js';

function openTrustedUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}

export default function AdminIntegrations() {
  const [state, setState] = useState({
    loading: true,
    error: '',
    status: null,
    templates: [],
    envelopes: [],
  });
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');

  const loadIntegration = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const status = await docusignApi.status();
      let templates = [];
      let envelopes = [];
      if (status.authenticated) {
        [templates, envelopes] = await Promise.all([
          docusignApi.listTemplates().catch(() => []),
          docusignApi.listEnvelopes().catch(() => []),
        ]);
      }
      setState({ loading: false, error: '', status, templates, envelopes });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => {
    loadIntegration();
  }, [loadIntegration]);

  const connectJwt = async () => {
    setWorking(true);
    setNotice('');
    try {
      const result = await docusignApi.connectJwt();
      if (result.consentUrl) {
        openTrustedUrl(result.consentUrl);
        setNotice('Grant consent in the new tab, then refresh the connection status.');
      } else {
        setNotice('DocuSign connected.');
        await loadIntegration();
      }
    } catch (error) {
      const consentUrl = error.payload?.consentUrl;
      if (consentUrl && openTrustedUrl(consentUrl)) {
        setNotice('Grant consent in the new tab, then connect again.');
      } else {
        setNotice(error.message);
      }
    } finally {
      setWorking(false);
    }
  };

  const connectOAuth = async () => {
    setWorking(true);
    try {
      const result = await docusignApi.getOAuthUrl();
      if (!openTrustedUrl(result.authUrl)) throw new Error('The server did not return a secure authorization URL.');
      setNotice('Complete authorization in the new tab, then refresh the status.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setWorking(false);
    }
  };

  const disconnect = async () => {
    setWorking(true);
    try {
      await docusignApi.disconnect();
      setNotice('DocuSign disconnected.');
      await loadIntegration();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        actions={<Button icon="refresh" onClick={loadIntegration} variant="secondary">Refresh status</Button>}
        description="Monitor optional signing services without interrupting core request processing."
        eyebrow="Administration"
        title="Integrations"
      />

      {notice ? <Alert variant={/failed|did not|unable|error/i.test(notice) ? 'danger' : 'info'}>{notice}</Alert> : null}
      {state.error ? (
        <Alert title="DocuSign is currently unavailable" variant="danger">
          {state.error} Core letter requests remain available.
        </Alert>
      ) : null}

      {state.loading ? <LoadingState label="Checking integrations" /> : (
        <div className="page-stack">
          <Card className="integration-card">
            <div className="integration-card__identity">
              <span className="integration-logo">DS</span>
              <div>
                <h2>DocuSign</h2>
                <p>Embedded signatures and envelope tracking</p>
              </div>
            </div>
            <div className="integration-card__status">
              <StatusBadge status={state.status?.authenticated ? 'connected' : 'not connected'} />
              {state.status?.accountId ? <span>Account {state.status.accountId}</span> : null}
            </div>
            <div className="form-actions">
              {state.status?.authenticated ? (
                <Button loading={working} onClick={disconnect} variant="danger-ghost">Disconnect</Button>
              ) : (
                <>
                  <Button loading={working} onClick={connectJwt}>Connect securely</Button>
                  <Button disabled={working} onClick={connectOAuth} variant="secondary">Use OAuth</Button>
                </>
              )}
            </div>
          </Card>

          {state.status?.authenticated ? (
            <div className="content-grid">
              <Card className="content-card">
                <div className="card-header">
                  <div><p className="eyebrow">DocuSign</p><h2>Available templates</h2></div>
                </div>
                {state.templates.length ? (
                  <ul className="simple-list">
                    {state.templates.slice(0, 6).map((template) => (
                      <li key={template.templateId || template.id}>
                        <strong>{template.name}</strong>
                        <span>{template.description || 'Signing template'}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted-copy">No DocuSign templates were returned.</p>}
              </Card>
              <Card className="content-card">
                <div className="card-header">
                  <div><p className="eyebrow">DocuSign</p><h2>Recent envelopes</h2></div>
                </div>
                {state.envelopes.length ? (
                  <ul className="simple-list">
                    {state.envelopes.slice(0, 6).map((envelope) => (
                      <li key={envelope.envelopeId}>
                        <strong>Envelope {envelope.envelopeId?.slice(-8)}</strong>
                        <span>{envelope.status} · {formatDate(envelope.created)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted-copy">No recent envelopes were returned.</p>}
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
