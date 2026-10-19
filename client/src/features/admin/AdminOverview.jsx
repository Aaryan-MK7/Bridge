import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { employeeApi, letterRequestApi } from '../../api/resources.js';
import {
  Alert,
  Button,
  Card,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../../components/ui/index.jsx';
import { formatLetterType } from '../../lib/contracts.js';
import { countByStatus, formatDate } from '../../lib/format.js';

export default function AdminOverview() {
  const [state, setState] = useState({
    loading: true,
    error: '',
    employees: [],
    requests: [],
  });

  const loadDashboard = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [employees, requests] = await Promise.all([
        employeeApi.list(),
        letterRequestApi.listAll(),
      ]);
      setState({
        loading: false,
        error: '',
        employees: employees || [],
        requests: requests || [],
      });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const pending = countByStatus(state.requests, ['pending', 'letter_generated']);
  const approved = countByStatus(state.requests, ['approved', 'completed']);
  const rejected = countByStatus(state.requests, ['rejected']);
  const recent = state.requests.slice(0, 5);
  const total = state.requests.length || 1;

  return (
    <div className="page-stack">
      <PageHeader
        actions={<Button icon="refresh" onClick={loadDashboard} variant="secondary">Refresh</Button>}
        description="Monitor demand, unblock requests, and manage document operations."
        eyebrow="Admin workspace"
        title="Operations overview"
      />

      {state.error ? (
        <Alert title="Dashboard data is unavailable" variant="danger">{state.error}</Alert>
      ) : null}

      <div className="stat-grid stat-grid--four">
        <StatCard accent="indigo" detail="Active directory records" icon="people" label="Employees" value={state.employees.length} />
        <StatCard accent="amber" detail="Requires attention" icon="history" label="Open queue" value={pending} />
        <StatCard accent="teal" detail="Approved or completed" icon="check" label="Delivered" value={approved} />
        <StatCard accent="red" detail="Across all time" icon="alert" label="Rejected" value={rejected} />
      </div>

      {state.loading ? <LoadingState label="Loading workspace" /> : (
        <div className="content-grid content-grid--admin-overview">
          <Card className="content-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Priority queue</p>
                <h2>Recent requests</h2>
              </div>
              <Link className="text-link" to="/admin/requests">Open queue</Link>
            </div>
            <div className="request-list">
              {recent.length ? recent.map((request) => (
                <Link className="request-row" key={request._id} to="/admin/requests">
                  <span className="request-row__icon" aria-hidden="true">
                    {request.employeeName?.slice(0, 1) || 'E'}
                  </span>
                  <span className="request-row__main">
                    <strong>{request.employeeName || request.employeeId}</strong>
                    <span>{formatLetterType(request.letterType)} · {formatDate(request.requestDate || request.createdAt)}</span>
                  </span>
                  <StatusBadge status={request.status} />
                </Link>
              )) : <p className="muted-copy">No letter requests have been submitted.</p>}
            </div>
          </Card>

          <Card className="content-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Request health</p>
                <h2>Lifecycle mix</h2>
              </div>
            </div>
            <div className="status-breakdown">
              {[
                ['Open', pending, 'amber'],
                ['Delivered', approved, 'teal'],
                ['Rejected', rejected, 'red'],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div><span>{label}</span><strong>{value}</strong></div>
                  <span className="progress-track">
                    <span className={`progress-bar progress-bar--${color}`} style={{ width: `${(value / total) * 100}%` }} />
                  </span>
                </div>
              ))}
            </div>
            <div className="quick-actions">
              <Link to="/admin/employees"><strong>Employee directory</strong><span>Manage people and roles →</span></Link>
              <Link to="/admin/templates"><strong>Letter templates</strong><span>Update request options →</span></Link>
              <Link to="/admin/integrations"><strong>Integrations</strong><span>Review DocuSign status →</span></Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
