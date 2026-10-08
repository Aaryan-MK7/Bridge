const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');

// Get SMTP settings (env fallback happens in mailer)
router.get('/smtp', async (req, res) => {
  try {
    const s = await Setting.findOne({ key: 'smtp' }).lean();
    res.json(s?.value || {});
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update SMTP settings
router.put('/smtp', async (req, res) => {
  try {
    const { host, port, user, pass, from, adminEmail } = req.body || {};
    const doc = await Setting.findOneAndUpdate(
      { key: 'smtp' },
      { value: { host, port, user, pass, from, adminEmail } },
      { new: true, upsert: true }
    );
    res.json(doc.value);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
