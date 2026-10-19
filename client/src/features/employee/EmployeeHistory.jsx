import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { downloadBlob } from '../../api/client.js';
import { letterRequestApi } from '../../api/resources.js';
import { useAuth } from '../../auth/useAuth.js';
import {
  Alert,
  Button,
  Card,
  Dialog,
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../components/ui/index.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { formatLetterType, isRequestOpen } from '../../lib/contracts.js';
import { formatDate } from '../../lib/format.js';

export default function EmployeeHistory() {
  const { employee } = useAuth();
  const location = useLocation();
  const [state, setState] = useState({ loading: true, error: '', requests: [] });
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(null);
  const [workingId, setWorkingId] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');

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

  const visibleRequests = useMemo(() => state.requests.filter((request) => {
    const matchesStatus = filter === 'all' || request.status === filter;
    const haystack = `${request.letterType} ${request.employeeComments || ''}`.toLowerCase();
    return matchesStatus && haystack.includes(search.trim().toLowerCase());
  }), [filter, search, state.requests]);

  const handleDownload = async (request) => {
    setWorkingId(request._id);
    setNotice('');
    try {
      const file = await letterRequestApi.download(request._id);
      downloadBlob(
        file.blob,
        file.filename || `${formatLetterType(request.letterType).replace(/\s+/g, '-')}.docx`,
      );
      setNotice('Your document download has started.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setWorkingId('');
    }
  };

  const handleWithdraw = async () => {
    if (!confirmWithdraw) return;
    setWorkingId(confirmWithdraw._id);
    try {
      await letterRequestApi.withdraw(confirmWithdraw._id);
      setConfirmWithdraw(null);
      setNotice('The request was withdrawn.');
      await loadRequests();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        actions={<Button icon="refresh" onClick={loadRequests} variant="secondary">Refresh</Button>}
        description="Review status, details, and approved documents."
        eyebrow="Letters"
        title="Request history"
      />

      {notice ? (
        <Alert variant={/failed|unable|error/i.test(notice) ? 'danger' : 'success'}>
          {notice}
        </Alert>
      ) : null}
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <Card className="content-card">
        <div className="filter-bar">
          <div className="search-control">
            <Icon name="search" size={18} />
            <input
              aria-label="Search requests"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by letter type"
              type="search"
              value={search}
            />
          </div>
          <label className="compact-field">
            <span>Status</span>
            <select onChange={(event) => setFilter(event.target.value)} value={filter}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>

        {state.loading ? <LoadingState label="Loading request history" /> : visibleRequests.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Letter</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map((request) => (
                  <tr key={request._id}>
                    <td data-label="Letter">
                      <strong>{formatLetterType(request.letterType)}</strong>
                      <small className="table-subtext">#{request._id.slice(-6).toUpperCase()}</small>
                    </td>
                    <td data-label="Requested">{formatDate(request.requestDate || request.createdAt)}</td>
                    <td data-label="Status"><StatusBadge status={request.status} /></td>
                    <td className="table-actions">
                      <Button onClick={() => setSelected(request)} variant="ghost">Details</Button>
                      {['approved', 'completed'].includes(request.status) ? (
                        <Button
                          icon="download"
                          loading={workingId === request._id}
                          onClick={() => handleDownload(request)}
                          variant="secondary"
                        >
                          Download
                        </Button>
                      ) : null}
                      {isRequestOpen(request.status) ? (
                        <Button onClick={() => setConfirmWithdraw(request)} variant="danger-ghost">
                          Withdraw
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            description={state.requests.length ? 'Try a different search or status.' : 'Submitted requests will appear here.'}
            title={state.requests.length ? 'No matching requests' : 'No request history'}
          />
        )}
      </Card>

      <Dialog
        description="Request details and processing timeline."
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        title={formatLetterType(selected?.letterType)}
      >
        {selected ? (
          <div className="dialog__body">
            <div className="detail-summary">
              <div><span>Status</span><StatusBadge status={selected.status} /></div>
              <div><span>Requested</span><strong>{formatDate(selected.requestDate || selected.createdAt)}</strong></div>
              <div><span>Reference</span><strong>#{selected._id.slice(-6).toUpperCase()}</strong></div>
            </div>
            <h3>Request details</h3>
            <dl className="review-list review-list--compact">
              {Object.entries(selected.details || {}).map(([key, value]) => (
                <div key={key}><dt>{formatLetterType(key)}</dt><dd>{value || '—'}</dd></div>
              ))}
              <div><dt>Comments</dt><dd>{selected.employeeComments || 'None'}</dd></div>
              {selected.adminNotes ? <div><dt>HR notes</dt><dd>{selected.adminNotes}</dd></div> : null}
            </dl>
            <h3>Timeline</h3>
            <ol className="timeline">
              <li className="timeline__item timeline__item--complete">
                <span /><div><strong>Request submitted</strong><p>{formatDate(selected.requestDate || selected.createdAt)}</p></div>
              </li>
              <li className={`timeline__item ${selected.status !== 'pending' ? 'timeline__item--complete' : ''}`}>
                <span /><div><strong>HR review</strong><p>{selected.status === 'pending' ? 'In progress' : formatDate(selected.processedDate)}</p></div>
              </li>
              <li className={`timeline__item ${['approved', 'completed'].includes(selected.status) ? 'timeline__item--complete' : ''}`}>
                <span /><div><strong>Document ready</strong><p>{['approved', 'completed'].includes(selected.status) ? 'Available to download' : 'Waiting for approval'}</p></div>
              </li>
            </ol>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        description="This action cannot be undone. You can submit a new request later."
        onClose={() => setConfirmWithdraw(null)}
        open={Boolean(confirmWithdraw)}
        title="Withdraw this request?"
      >
        <div className="dialog__body">
          <div className="form-actions form-actions--end">
            <Button onClick={() => setConfirmWithdraw(null)} variant="secondary">Keep request</Button>
            <Button
              loading={workingId === confirmWithdraw?._id}
              onClick={handleWithdraw}
              variant="danger"
            >
              Withdraw request
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
