import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { letterRequestApi } from '../../api/resources.js';
import { useAuth } from '../../auth/useAuth.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../../components/ui/index.jsx';
import { countByStatus, formatDate } from '../../lib/format.js';
import { formatLetterType } from '../../lib/contracts.js';

export default function EmployeeOverview() {
  const { employee } = useAuth();
  const [state, setState] = useState({ loading: true, error: '', requests: [] });

  const loadRequests = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const requests = await letterRequestApi.listForEmployee(employee.employeeId);
      setState({ loading: false, error: '', requests: requests || [] });
    } catch (error) {
      setState({ loading: false, error: error.message, requests: [] });
    }
  }, [employee.employeeId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const { requests } = state;
  const pending = countByStatus(requests, ['pending', 'letter_generated', 'sent_for_signing']);
  const completed = countByStatus(requests, ['approved', 'completed']);
  const recent = requests.slice(0, 4);
  const firstName = employee.name?.split(/\s+/)[0] || 'there';

  return (
    <div className="page-stack">
      <PageHeader
        actions={<Link className="button button--primary" to="/employee/request">New letter request</Link>}
        description="Track your letters and take the next step from one place."
        eyebrow="Employee portal"
        title={`Good to see you, ${firstName}`}
      />

      {state.error ? (
        <Alert title="We could not load your requests" variant="danger">
          <p>{state.error}</p>
          <Button onClick={loadRequests} variant="link">Try again</Button>
        </Alert>
      ) : null}

      <div className="stat-grid">
        <StatCard accent="indigo" detail="Across all time" icon="file" label="Total requests" value={requests.length} />
        <StatCard accent="amber" detail="Waiting on HR or signature" icon="history" label="In progress" value={pending} />
        <StatCard accent="teal" detail="Ready or delivered" icon="check" label="Completed" value={completed} />
      </div>

      <div className="content-grid content-grid--overview">
        <Card className="content-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h2>Your requests</h2>
            </div>
            <Link className="text-link" to="/employee/history">View all</Link>
          </div>
          {state.loading ? <LoadingState label="Loading requests" /> : recent.length ? (
            <div className="request-list">
              {recent.map((request) => (
                <Link className="request-row" key={request._id} to="/employee/history">
                  <span className="request-row__icon" aria-hidden="true">
                    {formatLetterType(request.letterType).slice(0, 1)}
                  </span>
                  <span className="request-row__main">
                    <strong>{formatLetterType(request.letterType)}</strong>
                    <span>Requested {formatDate(request.requestDate || request.createdAt)}</span>
                  </span>
                  <StatusBadge status={request.status} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              action={<Link className="button button--secondary" to="/employee/request">Start a request</Link>}
              description="Your submitted letter requests will appear here."
              title="No requests yet"
            />
          )}
        </Card>

        <Card className="content-card process-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">How it works</p>
              <h2>From request to document</h2>
            </div>
          </div>
          <ol className="process-list">
            <li>
              <span>1</span>
              <div><strong>Submit details</strong><p>Choose a letter and review the information.</p></div>
            </li>
            <li>
              <span>2</span>
              <div><strong>HR reviews</strong><p>Your request is checked and prepared.</p></div>
            </li>
            <li>
              <span>3</span>
              <div><strong>Download securely</strong><p>Approved documents stay in your history.</p></div>
            </li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
