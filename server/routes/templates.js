const express = require('express');
const router = express.Router();
const LetterTemplate = require('../models/LetterTemplate');

// List templates
router.get('/', async (req, res) => {
  try {
    const templates = await LetterTemplate.find({}).sort({ label: 1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create template
router.post('/', async (req, res) => {
  try {
    const { label, value, url, fields } = req.body;
    if (!label || !value) return res.status(400).json({ error: 'label and value are required' });
    const created = await LetterTemplate.create({ label, value, url: url || '', fields: fields || [] });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Template value must be unique' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update template
router.patch('/:id', async (req, res) => {
  try {
    const { label, value, url, fields, isActive } = req.body;
    const updated = await LetterTemplate.findByIdAndUpdate(
      req.params.id,
      { label, value, url, fields, isActive },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Template not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete template
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await LetterTemplate.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Template not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
