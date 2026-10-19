const express = require('express');
const { asyncHandler } = require('../middleware/errors');
const {
  requireObject,
  validateEmail,
} = require('../utils/validation');

function createSettingsRouter({ Setting, auth, emailService }) {
  const router = express.Router();
  router.use(auth.requireAuth, auth.requireAdmin);

  router.get('/notifications', asyncHandler(async (req, res) => {
    const setting = await Setting.findOne({ key: 'notifications' }).lean();
    res.json(notificationSettings(setting?.value, emailService));
  }));

  router.put('/notifications', asyncHandler(async (req, res) => {
    requireObject(req.body);
    const next = {
      adminEmail: validateEmail(req.body.adminEmail, 'adminEmail') || '',
    };
    const setting = await Setting.findOneAndUpdate(
      { key: 'notifications' },
      { $set: { value: next } },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(notificationSettings(setting.value, emailService));
  }));

  return router;
}

function notificationSettings(value = {}, emailService) {
  return {
    adminEmail: value.adminEmail || '',
    delivery: emailService.getConfigurationStatus(),
  };
}

module.exports = {
  createSettingsRouter,
  notificationSettings,
};
