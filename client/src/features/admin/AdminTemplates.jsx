import { useCallback, useEffect, useState } from 'react';

import { templateApi } from '../../api/resources.js';
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

const blankTemplate = {
  label: '',
  value: '',
  url: '',
  isActive: true,
  fields: [{ name: '', label: '', type: 'text', required: true }],
};

function toForm(template) {
  if (!template) return structuredClone(blankTemplate);
  return {
    ...template,
    fields: template.fields?.length
      ? template.fields.map((field) => ({ required: true, ...field }))
      : [{ name: '', label: '', type: 'text', required: true }],
  };
}

export default function AdminTemplates() {
  const [state, setState] = useState({ loading: true, error: '', templates: [] });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(toForm());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');

  const loadTemplates = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const templates = await templateApi.list();
      setState({ loading: false, error: '', templates: templates || [] });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const openEditor = (template = null) => {
    setEditing(template || { _id: null });
    setForm(toForm(template));
  };

  const updateField = (index, property, value) => {
    setForm((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) => (
        fieldIndex === index ? { ...field, [property]: value } : field
      )),
    }));
  };

  const saveTemplate = async (event) => {
    event.preventDefault();
    setWorking(true);
    try {
      const payload = {
        ...form,
        value: form.value.trim().toLowerCase().replace(/\s+/g, '_'),
        fields: form.fields.filter((field) => field.name.trim() && field.label.trim()),
      };
      if (editing._id) await templateApi.update(editing._id, payload);
      else await templateApi.create(payload);
      setEditing(null);
      setNotice(`Template ${editing._id ? 'updated' : 'created'}.`);
      await loadTemplates();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setWorking(false);
    }
  };

  const removeTemplate = async () => {
    if (!confirmDelete) return;
    setWorking(true);
    try {
      await templateApi.remove(confirmDelete._id);
      setConfirmDelete(null);
      setNotice('Template removed.');
      await loadTemplates();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        actions={<Button icon="request" onClick={() => openEditor()}>New template</Button>}
        description="Control available letter types and the information employees provide."
        eyebrow="Content"
        title="Letter templates"
      />
      {notice ? <Alert variant={/failed|error|unable/i.test(notice) ? 'danger' : 'success'}>{notice}</Alert> : null}
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      {state.loading ? <LoadingState label="Loading templates" /> : state.templates.length ? (
        <div className="template-grid">
          {state.templates.map((template) => (
            <Card className="template-card" key={template._id}>
              <div className="template-card__top">
                <span className="request-row__icon" aria-hidden="true">{template.label.slice(0, 1)}</span>
                <StatusBadge status={template.isActive === false ? 'inactive' : 'active'} />
              </div>
              <div>
                <h2>{template.label}</h2>
                <p>{template.fields?.length || 0} request fields · {template.value}</p>
              </div>
              {template.url ? (
                <a className="text-link" href={template.url} rel="noreferrer" target="_blank">Open source document</a>
              ) : <span className="muted-copy">No source URL</span>}
              <div className="form-actions">
                <Button icon="edit" onClick={() => openEditor(template)} variant="secondary">Edit</Button>
                <Button icon="trash" onClick={() => setConfirmDelete(template)} variant="danger-ghost">Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            action={<Button onClick={() => openEditor()}>Create template</Button>}
            description="Create the first template employees can request."
            icon="template"
            title="No templates"
          />
        </Card>
      )}

      <Dialog
        description="Define the label, API value, and fields shown in the employee request form."
        onClose={() => setEditing(null)}
        open={Boolean(editing)}
        title={editing?._id ? 'Edit template' : 'New template'}
      >
        <form className="dialog__body" onSubmit={saveTemplate}>
          <div className="form-grid">
            <Field
              label="Display label"
              name="template-label"
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              required
              value={form.label}
            />
            <Field
              hint="Stable lowercase value used by document generation."
              label="Template value"
              name="template-value"
              onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
              required
              value={form.value}
            />
            <Field
              label="Source document URL"
              name="template-url"
              onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
              type="url"
              value={form.url}
            />
            <label className="checkbox-field">
              <input
                checked={form.isActive !== false}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                type="checkbox"
              />
              <span><strong>Active</strong><small>Employees can choose this template.</small></span>
            </label>
          </div>

          <div className="field-builder">
            <div className="card-header">
              <div><h3>Request fields</h3><p>Collect only information required for this letter.</p></div>
              <Button
                onClick={() => setForm((current) => ({
                  ...current,
                  fields: [...current.fields, { name: '', label: '', type: 'text', required: true }],
                }))}
                variant="secondary"
              >
                Add field
              </Button>
            </div>
            {form.fields.map((field, index) => (
              <div className="field-row" key={`${index}-${field.name}`}>
                <input
                  aria-label={`Field ${index + 1} label`}
                  onChange={(event) => updateField(index, 'label', event.target.value)}
                  placeholder="Label"
                  value={field.label}
                />
                <input
                  aria-label={`Field ${index + 1} name`}
                  onChange={(event) => updateField(index, 'name', event.target.value)}
                  placeholder="fieldName"
                  value={field.name}
                />
                <select
                  aria-label={`Field ${index + 1} type`}
                  onChange={(event) => updateField(index, 'type', event.target.value)}
                  value={field.type || 'text'}
                >
                  <option value="text">Text</option>
                  <option value="date">Date</option>
                  <option value="number">Number</option>
                  <option value="email">Email</option>
                </select>
                <button
                  aria-label={`Remove field ${index + 1}`}
                  className="icon-button icon-button--danger"
                  disabled={form.fields.length === 1}
                  onClick={() => setForm((current) => ({
                    ...current,
                    fields: current.fields.filter((_, fieldIndex) => fieldIndex !== index),
                  }))}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="form-actions form-actions--end">
            <Button onClick={() => setEditing(null)} variant="secondary">Cancel</Button>
            <Button loading={working} type="submit">Save template</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        description="Employees will no longer be able to request this letter type."
        onClose={() => setConfirmDelete(null)}
        open={Boolean(confirmDelete)}
        title="Delete template?"
      >
        <div className="dialog__body">
          <p><strong>{confirmDelete?.label}</strong></p>
          <div className="form-actions form-actions--end">
            <Button onClick={() => setConfirmDelete(null)} variant="secondary">Cancel</Button>
            <Button loading={working} onClick={removeTemplate} variant="danger">Delete template</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
