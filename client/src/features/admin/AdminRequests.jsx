import { useCallback, useEffect, useMemo, useState } from 'react';

import { downloadBlob } from '../../api/client.js';
import { letterRequestApi } from '../../api/resources.js';
import { useAuth } from '../../auth/useAuth.js';
import {
  Alert,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../components/ui/index.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { formatLetterType } from '../../lib/contracts.js';
import { formatDate } from '../../lib/format.js';

export default function AdminRequests() {
  const { employee } = useAuth();
  const [state, setState] = useState({ loading: true, error: '', requests: [] });
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState(null);
  const [notes, setNotes] = useState('');
  const [working, setWorking] = useState('');
  const [notice, setNotice] = useState('');

  const loadRequests = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const requests = await letterRequestApi.listAll();
      setState({ loading: false, error: '', requests: requests || [] });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const visibleRequests = useMemo(() => state.requests.filter((request) => {
    const normalizedStatus = String(request.status || '').toLowerCase();
    const matchesFilter = filter === 'all'
      || (filter === 'pending' && ['pending', 'letter_generated'].includes(normalizedStatus))
      || normalizedStatus === filter;
    const haystack = `${request.employeeName} ${request.employeeId} ${request.letterType}`.toLowerCase();
    return matchesFilter && haystack.includes(search.trim().toLowerCase());
  }), [filter, search, state.requests]);

  const submitDecision = async () => {
    if (!decision) return;
    setWorking(decision.request._id);
    try {
      await letterRequestApi.updateStatus(decision.request._id, {
        status: decision.status,
        adminNotes: notes.trim(),
      });
      setDecision(null);
      setSelected(null);
      setNotes('');
      setNotice(`Request ${decision.status}.`);
      await loadRequests();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setWorking('');
    }
  };

  const downloadLetter = async (request) => {
    setWorking(request._id);
    try {
      const file = await letterRequestApi.download(request._id);
      downloadBlob(file.blob, file.filename || `letter-${request._id}.docx`);
      setNotice('Document download started.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setWorking('');
    }
  };

  const sendToDocuSign = async (request) => {
    if (!employee.email) {
      setNotice('Add an email address to your profile before starting DocuSign.');
      return;
    }
    setWorking(request._id);
    try {
      const result = await letterRequestApi.sendToDocuSign(request._id, employee.email);
      if (result.redirectUrl) {
        window.open(result.redirectUrl, '_blank', 'noopener,noreferrer');
      }
      setNotice('The document was sent to DocuSign.');
      await loadRequests();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setWorking('');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        actions={<Button icon="refresh" onClick={loadRequests} variant="secondary">Refresh queue</Button>}
        description="Review request context, record a decision, and deliver approved letters."
        eyebrow="Operations"
        title="Letter requests"
      />

      {notice ? <Alert variant={/before|failed|unable|error/i.test(notice) ? 'danger' : 'success'}>{notice}</Alert> : null}
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <Card className="content-card">
        <div className="filter-bar">
          <div className="search-control">
            <Icon name="search" size={18} />
            <input
              aria-label="Search requests"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee or letter"
              type="search"
              value={search}
            />
          </div>
          <label className="compact-field">
            <span>Status</span>
            <select onChange={(event) => setFilter(event.target.value)} value={filter}>
              <option value="all">All requests</option>
              <option value="pending">Open queue</option>
              <option value="approved">Approved</option>
              <option value="sent_for_signing">Sent for signing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </label>
        </div>

        {state.loading ? <LoadingState label="Loading request queue" /> : visibleRequests.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Letter</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map((request) => (
                  <tr key={request._id}>
                    <td data-label="Employee">
                      <strong>{request.employeeName || 'Employee'}</strong>
                      <small className="table-subtext">{request.employeeId}</small>
                    </td>
                    <td data-label="Letter">{formatLetterType(request.letterType)}</td>
                    <td data-label="Requested">{formatDate(request.requestDate || request.createdAt)}</td>
                    <td data-label="Status"><StatusBadge status={request.status} /></td>
                    <td className="table-actions">
                      <Button onClick={() => setSelected(request)} variant="ghost">Review</Button>
                      {['approved', 'completed'].includes(request.status) ? (
                        <Button
                          icon="download"
                          loading={working === request._id}
                          onClick={() => downloadLetter(request)}
                          variant="secondary"
                        >
                          Download
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
            description="No requests match the current filters."
            icon="history"
            title="Queue is clear"
          />
        )}
      </Card>

      <Dialog
        description="Review employee-provided information before making a decision."
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        title={selected ? `${formatLetterType(selected.letterType)} request` : 'Request'}
      >
        {selected ? (
          <div className="dialog__body">
            <div className="detail-summary">
              <div><span>Employee</span><strong>{selected.employeeName || selected.employeeId}</strong></div>
              <div><span>Requested</span><strong>{formatDate(selected.requestDate || selected.createdAt)}</strong></div>
              <div><span>Status</span><StatusBadge status={selected.status} /></div>
            </div>
            <h3>Submitted details</h3>
            <dl className="review-list review-list--compact">
              {Object.entries(selected.details || {}).map(([key, value]) => (
                <div key={key}><dt>{formatLetterType(key)}</dt><dd>{value || '—'}</dd></div>
              ))}
              <div><dt>Address</dt><dd>{selected.address || 'Not provided'}</dd></div>
              <div><dt>Employee comments</dt><dd>{selected.employeeComments || 'None'}</dd></div>
              {selected.adminNotes ? <div><dt>Admin notes</dt><dd>{selected.adminNotes}</dd></div> : null}
            </dl>
            <div className="form-actions form-actions--between">
              <div className="button-group">
                {['pending', 'letter_generated'].includes(selected.status) ? (
                  <>
                    <Button onClick={() => setDecision({ request: selected, status: 'rejected' })} variant="danger-ghost">Reject</Button>
                    <Button onClick={() => setDecision({ request: selected, status: 'approved' })}>Approve</Button>
                  </>
                ) : null}
              </div>
              {['approved', 'letter_generated'].includes(selected.status) ? (
                <Button
                  loading={working === selected._id}
                  onClick={() => sendToDocuSign(selected)}
                  variant="secondary"
                >
                  Send to DocuSign
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        description={`Add an optional note for the employee before you ${decision?.status || 'update'} this request.`}
        onClose={() => setDecision(null)}
        open={Boolean(decision)}
        title={`${decision?.status === 'approved' ? 'Approve' : 'Reject'} request?`}
      >
        <div className="dialog__body">
          <Field label="Note to employee" name="decisionNote">
            <textarea
              id="decisionNote"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Explain the decision or next steps."
              rows="4"
              value={notes}
            />
          </Field>
          <div className="form-actions form-actions--end">
            <Button onClick={() => setDecision(null)} variant="secondary">Cancel</Button>
            <Button
              loading={working === decision?.request._id}
              onClick={submitDecision}
              variant={decision?.status === 'rejected' ? 'danger' : 'primary'}
            >
              Confirm {decision?.status}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
