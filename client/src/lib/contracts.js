const SAFE_EMPLOYEE_FIELDS = [
  '_id',
  'employeeId',
  'name',
  'email',
  'title',
  'address',
  'startDate',
  'role',
];

export function normalizeRole(role) {
  return String(role || '').toLowerCase() === 'admin' ? 'admin' : 'user';
}

export function sanitizeEmployee(employee) {
  if (!employee || typeof employee !== 'object') return null;

  const safeEmployee = {};
  SAFE_EMPLOYEE_FIELDS.forEach((field) => {
    if (employee[field] !== undefined && employee[field] !== null) {
      safeEmployee[field] = employee[field];
    }
  });

  if (!safeEmployee.employeeId) return null;
  safeEmployee.role = normalizeRole(safeEmployee.role);
  return safeEmployee;
}

export function parseLoginResponse(payload) {
  if (!payload?.success || typeof payload.token !== 'string' || !payload.token.trim()) {
    throw new Error('The server returned an invalid sign-in response.');
  }

  const employee = sanitizeEmployee(payload.employee);
  if (!employee) {
    throw new Error('The server returned an invalid employee profile.');
  }

  return {
    token: payload.token.trim(),
    employee,
  };
}

export function getApiErrorMessage(payload, fallback = 'Something went wrong. Please try again.') {
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  if (!payload || typeof payload !== 'object') return fallback;
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  if (typeof payload.error?.message === 'string' && payload.error.message.trim()) {
    return payload.error.message;
  }
  if (typeof payload.details === 'string' && payload.details.trim()) return payload.details;
  return fallback;
}

export function validateLetterRequest({ letterType, details = {}, fields = [] }) {
  const errors = {};
  if (!letterType) errors.letterType = 'Choose a letter type.';

  fields.forEach((field) => {
    const value = details[field.name];
    if (field.required !== false && (!value || !String(value).trim())) {
      errors[field.name] = `${field.label || field.name} is required.`;
    }
  });

  return errors;
}

export function formatLetterType(value) {
  if (!value) return 'Letter request';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function isRequestOpen(status) {
  return ['pending', 'letter_generated'].includes(String(status || '').toLowerCase());
}
