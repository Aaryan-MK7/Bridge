import { useCallback, useEffect, useMemo, useState } from 'react';

import { employeeApi } from '../../api/resources.js';
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
import { formatDate } from '../../lib/format.js';

const blankEmployee = {
  employeeId: '',
  name: '',
  email: '',
  title: '',
  startDate: '',
  address: '',
  password: '',
};

export default function AdminEmployees() {
  const [state, setState] = useState({ loading: true, error: '', employees: [] });
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newEmployee, setNewEmployee] = useState(blankEmployee);
  const [confirmAction, setConfirmAction] = useState(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');

  const loadEmployees = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const employees = await employeeApi.list();
      setState({ loading: false, error: '', employees: employees || [] });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const visibleEmployees = useMemo(() => state.employees.filter((employee) => (
    `${employee.name} ${employee.employeeId} ${employee.email} ${employee.title}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  )), [search, state.employees]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setWorking(true);
    setNotice('');
    try {
      await employeeApi.create({
        employeeId: newEmployee.employeeId.trim(),
        name: newEmployee.name.trim(),
        email: newEmployee.email.trim(),
        title: newEmployee.title.trim(),
        startDate: newEmployee.startDate || undefined,
        address: newEmployee.address.trim(),
        password: newEmployee.password,
      });
      setShowCreate(false);
      setNewEmployee(blankEmployee);
      setNotice('Employee added.');
      await loadEmployees();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setWorking(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    setWorking(true);
    try {
      if (confirmAction.type === 'delete') {
        await employeeApi.remove(confirmAction.employee.employeeId);
        setNotice('Employee removed.');
      } else {
        const nextRole = confirmAction.employee.role === 'admin' ? 'user' : 'admin';
        await employeeApi.changeRole(confirmAction.employee.employeeId, nextRole);
        setNotice(`Employee role changed to ${nextRole}.`);
      }
      setConfirmAction(null);
      await loadEmployees();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setWorking(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setWorking(true);
    setNotice('');
    try {
      await employeeApi.importCsv(file);
      setNotice('Employee import completed.');
      await loadEmployees();
    } catch (error) {
      setNotice(error.message);
    } finally {
      event.target.value = '';
      setWorking(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        actions={<Button icon="request" onClick={() => setShowCreate(true)}>Add employee</Button>}
        description="Manage employee records, imports, and administrator access."
        eyebrow="People"
        title="Employee directory"
      />
      {notice ? <Alert variant={/failed|unable|error|denied/i.test(notice) ? 'danger' : 'success'}>{notice}</Alert> : null}
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <Card className="content-card">
        <div className="filter-bar">
          <div className="search-control">
            <Icon name="search" size={18} />
            <input
              aria-label="Search employees"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, ID, email, or title"
              type="search"
              value={search}
            />
          </div>
          <label className="button button--secondary file-button">
            <Icon name="file" size={18} />
            <span>{working ? 'Importing…' : 'Import CSV'}</span>
            <input accept=".csv,text/csv" disabled={working} onChange={handleImport} type="file" />
          </label>
        </div>

        {state.loading ? <LoadingState label="Loading employees" /> : visibleEmployees.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Title</th>
                  <th>Start date</th>
                  <th>Role</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee) => (
                  <tr key={employee.employeeId}>
                    <td data-label="Employee">
                      <strong>{employee.name}</strong>
                      <small className="table-subtext">{employee.employeeId} · {employee.email || 'No email'}</small>
                    </td>
                    <td data-label="Title">{employee.title || '—'}</td>
                    <td data-label="Start date">{formatDate(employee.startDate)}</td>
                    <td data-label="Role"><StatusBadge status={employee.role === 'admin' ? 'admin' : 'employee'} /></td>
                    <td className="table-actions">
                      <Button
                        onClick={() => setConfirmAction({ type: 'role', employee })}
                        variant="ghost"
                      >
                        {employee.role === 'admin' ? 'Remove admin' : 'Make admin'}
                      </Button>
                      <Button
                        onClick={() => setConfirmAction({ type: 'delete', employee })}
                        variant="danger-ghost"
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            description={state.employees.length ? 'Try another search.' : 'Add an employee or import a CSV to begin.'}
            icon="people"
            title="No employees found"
          />
        )}
      </Card>

      <Dialog
        description="Create a directory record. Identity fields can be updated later by an administrator."
        onClose={() => setShowCreate(false)}
        open={showCreate}
        title="Add employee"
      >
        <form className="dialog__body" onSubmit={handleCreate}>
          <div className="form-grid">
            {[
              ['employeeId', 'Employee ID', 'text', true],
              ['name', 'Full name', 'text', true],
              ['email', 'Work email', 'email', false],
              ['title', 'Job title', 'text', false],
              ['startDate', 'Start date', 'date', false],
              ['address', 'Home address', 'text', false],
              ['password', 'Temporary password', 'password', true],
            ].map(([name, label, type, required]) => (
              <Field
                key={name}
                label={label}
                name={`new-${name}`}
                onChange={(event) => setNewEmployee((current) => ({
                  ...current,
                  [name]: event.target.value,
                }))}
                required={required}
                type={type}
                value={newEmployee[name]}
              />
            ))}
          </div>
          <div className="form-actions form-actions--end">
            <Button onClick={() => setShowCreate(false)} variant="secondary">Cancel</Button>
            <Button loading={working} type="submit">Add employee</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        description={confirmAction?.type === 'delete'
          ? 'This removes access and the employee record. This action cannot be undone.'
          : 'Role changes take effect the next time this employee accesses a protected route.'}
        onClose={() => setConfirmAction(null)}
        open={Boolean(confirmAction)}
        title={confirmAction?.type === 'delete' ? 'Remove employee?' : 'Change employee role?'}
      >
        <div className="dialog__body">
          <p><strong>{confirmAction?.employee.name}</strong> · {confirmAction?.employee.employeeId}</p>
          <div className="form-actions form-actions--end">
            <Button onClick={() => setConfirmAction(null)} variant="secondary">Cancel</Button>
            <Button
              loading={working}
              onClick={executeConfirmedAction}
              variant={confirmAction?.type === 'delete' ? 'danger' : 'primary'}
            >
              Confirm change
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
