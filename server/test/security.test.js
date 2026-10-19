const assert = require('node:assert/strict');
const test = require('node:test');
const { safeEmployeeDto } = require('../domain/employees');
const { safeLetterRequestDto } = require('../domain/letterRequests');
const {
  canTransitionRequestStatus,
} = require('../domain/requestStatus');
const { parseEmployeeRequestInput } = require('../routes/letterRequests');
const { createTokenService } = require('../services/tokenService');
const {
  sanitizeDetails,
  validateEmail,
  validatePassword,
} = require('../utils/validation');

test('JWT contract signs scoped employee claims and rejects tampering', () => {
  const tokens = createTokenService({
    secret: 'test-secret-that-is-long-enough-for-hs256',
    expiresIn: '1h',
  });
  const token = tokens.sign({
    _id: '507f1f77bcf86cd799439011',
    employeeId: 'EMP-100',
  });
  const claims = tokens.verify(token);

  assert.equal(claims.sub, '507f1f77bcf86cd799439011');
  assert.equal(claims.employeeId, 'EMP-100');
  assert.equal(claims.iss, 'bridge-api');
  assert.throws(() => tokens.verify(`${token}tampered`));
});

test('employee serialization never exposes authentication or reset secrets', () => {
  const result = safeEmployeeDto({
    _id: '507f1f77bcf86cd799439011',
    employeeId: 'EMP-100',
    name: 'Taylor Employee',
    email: 'taylor@example.com',
    role: 'user',
    passwordHash: 'secret-hash',
    resetToken: 'secret-reset-token',
    resetTokenExpiry: new Date(),
  });

  assert.equal(result.employeeId, 'EMP-100');
  assert.equal(result.role, 'user');
  assert.equal(result.passwordHash, undefined);
  assert.equal(result.resetToken, undefined);
  assert.equal(result.resetTokenExpiry, undefined);
});

test('letter request serialization hides server filesystem and signing URLs', () => {
  const result = safeLetterRequestDto({
    _id: '507f1f77bcf86cd799439012',
    employeeId: 'EMP-100',
    status: 'approved',
    generatedLetterPath: '/private/generated/letter.docx',
    docusignSigningUrl: 'https://example.test/private-signing-link',
  });

  assert.equal(result.status, 'approved');
  assert.equal(result.generatedLetterPath, undefined);
  assert.equal(result.docusignSigningUrl, undefined);
});

test('request status transitions enforce the workflow state machine', () => {
  assert.equal(canTransitionRequestStatus('pending', 'approved'), true);
  assert.equal(canTransitionRequestStatus('pending', 'withdrawn'), true);
  assert.equal(canTransitionRequestStatus('approved', 'pending'), false);
  assert.equal(canTransitionRequestStatus('completed', 'approved'), false);
});

test('input validation normalizes safe values and rejects weak input', () => {
  assert.equal(validateEmail(' Person@Example.COM '), 'person@example.com');
  assert.equal(validatePassword('long-enough-password'), 'long-enough-password');
  assert.deepEqual(
    sanitizeDetails({ purpose: ' Travel ', days: 5, urgent: false }),
    { purpose: 'Travel', days: 5, urgent: false }
  );
  assert.throws(() => validatePassword('short'));
  assert.throws(() => validateEmail('not-an-email'));
  assert.throws(() => sanitizeDetails({ nested: { unsafe: true } }));
});

test('letter request input preserves sanitized address and comments', () => {
  assert.deepEqual(
    parseEmployeeRequestInput({
      letterType: ' visa ',
      address: '  10 Bridge Street  ',
      employeeComments: ' For the consulate ',
      details: { country: ' Canada ' },
    }),
    {
      letterType: 'visa',
      address: '10 Bridge Street',
      employeeComments: 'For the consulate',
      details: { country: 'Canada' },
    }
  );
});
