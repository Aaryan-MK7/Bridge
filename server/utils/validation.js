const mongoose = require('mongoose');
const { AppError } = require('../middleware/errors');

function requireObject(value, field = 'request body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be an object`);
  }
  return value;
}

function requiredString(value, field, options = {}) {
  const stringValue = typeof value === 'string' ? value.trim() : '';
  if (!stringValue) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} is required`);
  }
  return limitedString(stringValue, field, options.maxLength);
}

function optionalString(value, field, options = {}) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a string`);
  }
  return limitedString(value.trim(), field, options.maxLength);
}

function limitedString(value, field, maxLength = 500) {
  if (value.length > maxLength) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${field} must be at most ${maxLength} characters`
    );
  }
  return value;
}

function validateEmail(value, field = 'email', { required = false } = {}) {
  const email = required
    ? requiredString(value, field, { maxLength: 254 })
    : optionalString(value, field, { maxLength: 254 });
  if (!email) return email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a valid email address`);
  }
  return email.toLowerCase();
}

function validatePassword(value, field = 'password') {
  const password = requiredString(value, field, { maxLength: 128 });
  if (password.length < 8) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be at least 8 characters`);
  }
  return password;
}

function validateObjectId(value, field = 'id') {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(400, 'INVALID_ID', `${field} must be a valid object identifier`);
  }
  return value;
}

function sanitizeDetails(value) {
  if (value === undefined || value === null) return {};
  requireObject(value, 'details');
  const entries = Object.entries(value);
  if (entries.length > 50) {
    throw new AppError(400, 'VALIDATION_ERROR', 'details may contain at most 50 fields');
  }

  return Object.fromEntries(entries.map(([key, item]) => {
    const safeKey = requiredString(key, 'detail field name', { maxLength: 80 });
    if (!['string', 'number', 'boolean'].includes(typeof item)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `details.${safeKey} must be a string, number, or boolean`
      );
    }
    const safeValue = typeof item === 'string'
      ? limitedString(item.trim(), `details.${safeKey}`, 2000)
      : item;
    return [safeKey, safeValue];
  }));
}

module.exports = {
  optionalString,
  requireObject,
  requiredString,
  sanitizeDetails,
  validateEmail,
  validateObjectId,
  validatePassword,
};
