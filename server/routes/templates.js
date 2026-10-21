const express = require('express');
const { AppError, asyncHandler } = require('../middleware/errors');
const {
  optionalString,
  requireObject,
  requiredString,
  validateObjectId,
} = require('../utils/validation');

const FIELD_TYPES = new Set(['text', 'number', 'date', 'email']);

function createTemplatesRouter({ LetterTemplate, auth }) {
  const router = express.Router();
  router.use(auth.requireAuth);

  router.get('/', asyncHandler(async (req, res) => {
    const filter = req.employee.role === 'admin' ? {} : { isActive: true };
    const templates = await LetterTemplate.find(filter).sort({ label: 1 });
    res.json(templates);
  }));

  router.post('/', auth.requireAdmin, asyncHandler(async (req, res) => {
    const input = parseTemplate(req.body);
    const template = await LetterTemplate.create(input);
    res.status(201).json(template);
  }));

  router.patch('/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    validateObjectId(req.params.id, 'template id');
    const input = parseTemplate(req.body, { partial: true });
    const template = await LetterTemplate.findByIdAndUpdate(
      req.params.id,
      { $set: input },
      { new: true, runValidators: true }
    );
    if (!template) {
      throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
    }
    res.json(template);
  }));

  router.delete('/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    validateObjectId(req.params.id, 'template id');
    const template = await LetterTemplate.findByIdAndDelete(req.params.id);
    if (!template) {
      throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
    }
    res.json({ success: true });
  }));

  return router;
}

function parseTemplate(body, { partial = false } = {}) {
  requireObject(body);
  const template = {};
  if (!partial || body.label !== undefined) {
    template.label = requiredString(body.label, 'label', { maxLength: 160 });
  }
  if (!partial || body.value !== undefined) {
    template.value = requiredString(body.value, 'value', { maxLength: 80 }).toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(template.value)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'value may only contain lowercase letters, numbers, underscores, and hyphens'
      );
    }
  }
  if (!partial || body.url !== undefined) {
    template.url = validateTemplateUrl(body.url);
  }
  if (!partial || body.fields !== undefined) {
    template.fields = validateFields(body.fields);
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      throw new AppError(400, 'VALIDATION_ERROR', 'isActive must be a boolean');
    }
    template.isActive = body.isActive;
  }

  if (partial && Object.keys(template).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No editable template fields were provided');
  }
  return template;
}

function validateFields(fields) {
  if (fields === undefined) return [];
  if (!Array.isArray(fields) || fields.length > 30) {
    throw new AppError(400, 'VALIDATION_ERROR', 'fields must be an array with at most 30 entries');
  }

  const seen = new Set();
  return fields.map((field, index) => {
    requireObject(field, `fields[${index}]`);
    const name = requiredString(field.name, `fields[${index}].name`, { maxLength: 80 });
    const label = requiredString(field.label, `fields[${index}].label`, { maxLength: 160 });
    const type = optionalString(field.type, `fields[${index}].type`, { maxLength: 20 }) || 'text';
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) {
      throw new AppError(400, 'VALIDATION_ERROR', `fields[${index}].name is invalid`);
    }
    if (!FIELD_TYPES.has(type)) {
      throw new AppError(400, 'VALIDATION_ERROR', `fields[${index}].type is invalid`);
    }
    if (seen.has(name)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Duplicate template field: ${name}`);
    }
    seen.add(name);
    return { name, label, type, required: field.required !== false };
  });
}

function validateTemplateUrl(value) {
  const url = optionalString(value, 'url', { maxLength: 2000 }) || '';
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
    return parsed.toString();
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'url must be an absolute http(s) URL');
  }
}

module.exports = { createTemplatesRouter, parseTemplate };
