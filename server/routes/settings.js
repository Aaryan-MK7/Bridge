const express = require('express');
const { asyncHandler } = require('../middleware/errors');
const {
  optionalString,
  requireObject,
  validateEmail,
} = require('../utils/validation');

const PASSWORD_MASK = '********';

function createSettingsRouter({ Setting, auth }) {
  const router = express.Router();
  router.use(auth.requireAuth, auth.requireAdmin);

  router.get('/smtp', asyncHandler(async (req, res) => {
    const setting = await Setting.findOne({ key: 'smtp' }).lean();
    res.json(safeSmtpSettings(setting?.value));
  }));

  router.put('/smtp', asyncHandler(async (req, res) => {
    requireObject(req.body);
    const existing = await Setting.findOne({ key: 'smtp' }).lean();
    const current = existing?.value || {};
    const next = {
      host: optionalString(req.body.host, 'host', { maxLength: 255 }) || '',
      port: parsePort(req.body.port),
      user: optionalString(req.body.user, 'user', { maxLength: 255 }) || '',
      from: optionalString(req.body.from, 'from', { maxLength: 320 }) || '',
      adminEmail: validateEmail(req.body.adminEmail, 'adminEmail') || '',
      pass: current.pass || '',
    };

    const submittedPassword = optionalString(req.body.pass, 'pass', { maxLength: 1000 });
    if (submittedPassword && submittedPassword !== PASSWORD_MASK && !/^\*+$/.test(submittedPassword)) {
      next.pass = submittedPassword;
    }

    const setting = await Setting.findOneAndUpdate(
      { key: 'smtp' },
      { $set: { value: next } },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(safeSmtpSettings(setting.value));
  }));

  return router;
}

function parsePort(value) {
  if (value === undefined || value === null || value === '') return 587;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const { AppError } = require('../middleware/errors');
    throw new AppError(400, 'VALIDATION_ERROR', 'port must be an integer from 1 to 65535');
  }
  return port;
}

function safeSmtpSettings(value = {}) {
  const hasPassword = Boolean(value.pass);
  return {
    host: value.host || '',
    port: value.port || 587,
    user: value.user || '',
    pass: hasPassword ? PASSWORD_MASK : '',
    from: value.from || '',
    adminEmail: value.adminEmail || '',
    hasPassword,
  };
}

module.exports = {
  PASSWORD_MASK,
  createSettingsRouter,
  safeSmtpSettings,
};
