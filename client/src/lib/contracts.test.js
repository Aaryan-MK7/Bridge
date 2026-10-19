import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatLetterType,
  getApiErrorMessage,
  parseLoginResponse,
  sanitizeEmployee,
  validateLetterRequest,
} from './contracts.js';

test('login contract requires a token and strips sensitive employee fields', () => {
  const session = parseLoginResponse({
    success: true,
    token: 'signed-token',
    employee: {
      employeeId: 'E-100',
      name: 'Taylor Morgan',
      role: 'ADMIN',
      passwordHash: 'must-not-leak',
      resetPasswordToken: 'must-not-leak',
    },
  });

  assert.equal(session.employee.role, 'admin');
  assert.equal(session.employee.passwordHash, undefined);
  assert.equal(session.employee.resetPasswordToken, undefined);
});

test('invalid login responses are rejected', () => {
  assert.throws(
    () => parseLoginResponse({ success: true, employee: { employeeId: 'E-100' } }),
    /invalid sign-in response/i,
  );
});

test('employee DTO sanitizer only keeps the safe profile contract', () => {
  assert.deepEqual(
    sanitizeEmployee({
      employeeId: 'E-101',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      role: 'user',
      password: 'secret',
    }),
    {
      employeeId: 'E-101',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      role: 'user',
    },
  );
});

test('request validation reports missing dynamic fields', () => {
  const errors = validateLetterRequest({
    letterType: 'visa',
    details: { country: 'Canada' },
    fields: [
      { name: 'country', label: 'Country' },
      { name: 'purpose', label: 'Purpose' },
    ],
  });

  assert.deepEqual(errors, { purpose: 'Purpose is required.' });
});

test('API errors and letter labels are normalized for display', () => {
  assert.equal(getApiErrorMessage({ error: 'Access denied' }), 'Access denied');
  assert.equal(formatLetterType('travel_noc'), 'Travel Noc');
});
