import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { letterRequestApi, templateApi } from '../../api/resources.js';
import { useAuth } from '../../auth/useAuth.js';
import { Alert, Button, Card, Field, PageHeader } from '../../components/ui/index.jsx';
import { validateLetterRequest } from '../../lib/contracts.js';
import { fallbackLetterTypes, mergeLetterTypes } from './letterTypes.js';

const initialForm = {
  letterType: '',
  address: '',
  employeeComments: '',
  details: {},
};

export default function NewRequest() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const [letterTypes, setLetterTypes] = useState(fallbackLetterTypes);
  const [form, setForm] = useState({ ...initialForm, address: employee.address || '' });
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState('details');
  const [status, setStatus] = useState({ loading: false, error: '' });

  useEffect(() => {
    templateApi.list()
      .then((templates) => setLetterTypes(mergeLetterTypes(templates)))
      .catch(() => setLetterTypes(fallbackLetterTypes));
  }, []);

  const selectedType = useMemo(
    () => letterTypes.find((type) => type.value === form.letterType),
    [form.letterType, letterTypes],
  );
  const fields = selectedType?.fields || [];

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const updateDetail = (name, value) => {
    setForm((current) => ({
      ...current,
      details: { ...current.details, [name]: value },
    }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const reviewRequest = (event) => {
    event.preventDefault();
    const validationErrors = validateLetterRequest({
      details: form.details,
      fields,
      letterType: form.letterType,
    });
    setErrors(validationErrors);
    if (!Object.keys(validationErrors).length) setStep('review');
  };

  const submitRequest = async () => {
    setStatus({ loading: true, error: '' });
    try {
      const result = await letterRequestApi.create({
        letterType: form.letterType,
        details: form.details,
        address: form.address.trim(),
        employeeComments: form.employeeComments.trim(),
      });
      navigate('/employee/history', {
        replace: true,
        state: { notice: result.warning || 'Your letter request was submitted.' },
      });
    } catch (error) {
      setStatus({ loading: false, error: error.message });
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        description="Tell HR what you need, review the details, then submit."
        eyebrow="Letters"
        title="New letter request"
      />

      <div className="stepper" aria-label="Request progress">
        <span className="stepper__item stepper__item--active"><b>1</b> Request details</span>
        <span aria-hidden="true" className="stepper__line" />
        <span className={`stepper__item ${step === 'review' ? 'stepper__item--active' : ''}`}><b>2</b> Review & submit</span>
      </div>

      {status.error ? <Alert variant="danger">{status.error}</Alert> : null}

      {step === 'details' ? (
        <form className="request-form-layout" onSubmit={reviewRequest}>
          <Card className="content-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2>Choose a letter</h2>
              </div>
            </div>
            <fieldset className="letter-choice-grid">
              <legend className="sr-only">Letter type</legend>
              {letterTypes.map((type) => (
                <label className={`letter-choice ${form.letterType === type.value ? 'letter-choice--selected' : ''}`} key={type.value}>
                  <input
                    checked={form.letterType === type.value}
                    name="letterType"
                    onChange={() => {
                      setForm((current) => ({ ...current, letterType: type.value, details: {} }));
                      setErrors({});
                    }}
                    type="radio"
                    value={type.value}
                  />
                  <span className="letter-choice__mark" aria-hidden="true">
                    {type.label.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{type.label}</strong>
                    <small>{type.description || 'Request this letter from HR.'}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            {errors.letterType ? <span className="field__error" role="alert">{errors.letterType}</span> : null}
          </Card>

          {selectedType ? (
            <Card className="content-card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Letter information</p>
                  <h2>{selectedType.label}</h2>
                </div>
              </div>
              <div className="form-grid">
                {fields.map((field) => (
                  <Field
                    error={errors[field.name]}
                    key={field.name}
                    label={field.label}
                    name={field.name}
                    onChange={(event) => updateDetail(field.name, event.target.value)}
                    required={field.required !== false}
                    type={field.type || 'text'}
                    value={form.details[field.name] || ''}
                  />
                ))}
                <Field
                  label="Address for the letter"
                  name="address"
                  onChange={(event) => updateForm('address', event.target.value)}
                  value={form.address}
                />
                <Field label="Additional context" name="employeeComments">
                  <textarea
                    id="employeeComments"
                    name="employeeComments"
                    onChange={(event) => updateForm('employeeComments', event.target.value)}
                    placeholder="Add information that will help HR prepare the document."
                    rows="4"
                    value={form.employeeComments}
                  />
                </Field>
              </div>
              <div className="form-actions">
                <Button type="submit">Review request</Button>
              </div>
            </Card>
          ) : null}
        </form>
      ) : (
        <Card className="review-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Confirm your request</h2>
              <p>HR will receive only the information shown below.</p>
            </div>
          </div>
          <dl className="review-list">
            <div><dt>Employee</dt><dd>{employee.name} · {employee.employeeId}</dd></div>
            <div><dt>Letter type</dt><dd>{selectedType?.label}</dd></div>
            {fields.map((field) => (
              <div key={field.name}>
                <dt>{field.label}</dt>
                <dd>{form.details[field.name] || 'Not provided'}</dd>
              </div>
            ))}
            <div><dt>Address</dt><dd>{form.address || 'Not provided'}</dd></div>
            <div><dt>Additional context</dt><dd>{form.employeeComments || 'None'}</dd></div>
          </dl>
          <Alert variant="info">
            Your identity and initial request status are assigned securely by the server.
          </Alert>
          <div className="form-actions form-actions--between">
            <Button onClick={() => setStep('details')} variant="secondary">Back to edit</Button>
            <Button loading={status.loading} onClick={submitRequest}>Submit request</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
