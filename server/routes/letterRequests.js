const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;
const { safeLetterRequestDto } = require('../domain/letterRequests');
const {
  canTransitionRequestStatus,
} = require('../domain/requestStatus');
const { AppError, asyncHandler } = require('../middleware/errors');
const {
  optionalString,
  requireObject,
  requiredString,
  sanitizeDetails,
  validateEmail,
  validateObjectId,
} = require('../utils/validation');

function createLetterRequestsRouter({
  LetterRequest,
  Employee,
  LetterTemplate,
  auth,
  letterGenerator,
  emailService,
  docusignRegistry,
  Setting,
  config,
}) {
  const router = express.Router();
  router.use(auth.requireAuth);

  router.post('/', asyncHandler(async (req, res) => {
    requireObject(req.body);
    const input = parseEmployeeRequestInput(req.body);
    const template = await findActiveTemplate(LetterTemplate, input.letterType);
    input.details = validateTemplateDetails(input.details, template.fields);
    const request = new LetterRequest({
      employeeId: req.employee.employeeId,
      employeeName: req.employee.name,
      letterType: input.letterType,
      details: input.details,
      address: input.address,
      employeeComments: input.employeeComments,
      status: 'pending',
    });
    await request.save();

    let documentWarning;
    try {
      await generateLetter({ request, letterGenerator });
    } catch {
      documentWarning = 'The request was saved, but its document could not be generated.';
    }

    const notificationEmail = await getNotificationEmail(Setting, config.adminEmail);
    if (notificationEmail) {
      await emailService.sendLetterRequestNotification(
        safeLetterRequestDto(request),
        notificationEmail
      );
    }

    const body = { request: safeLetterRequestDto(request) };
    if (documentWarning) body.warning = documentWarning;
    res.status(201).json(body);
  }));

  router.get('/test-email', auth.requireAdmin, asyncHandler(async (req, res) => {
    const configStatus = emailService.getConfigurationStatus();
    if (!configStatus.fullyConfigured) {
      throw new AppError(503, 'EMAIL_UNAVAILABLE', 'Email notifications are not configured');
    }
    const notificationEmail = await getNotificationEmail(Setting, config.adminEmail)
      || req.employee.email;
    if (!notificationEmail) {
      throw new AppError(
        400,
        'NOTIFICATION_EMAIL_REQUIRED',
        'Set an operations notification email or add an email to your administrator profile'
      );
    }
    const result = await emailService.sendLetterRequestNotification({
      employeeId: req.employee.employeeId,
      employeeName: req.employee.name,
      letterType: 'Configuration test',
      requestDate: new Date(),
    }, notificationEmail);
    res.json({ success: Boolean(result.success), configStatus });
  }));

  router.get('/', auth.requireAdmin, asyncHandler(async (req, res) => {
    const requests = await LetterRequest.find({}).sort({ requestDate: -1 });
    res.json(requests.map(safeLetterRequestDto));
  }));

  router.get(
    '/employee/:employeeId',
    auth.requireSelfOrAdmin(),
    asyncHandler(async (req, res) => {
      const requests = await LetterRequest.find({
        employeeId: req.params.employeeId,
      }).sort({ requestDate: -1 });
      res.json(requests.map(safeLetterRequestDto));
    })
  );

  router.patch('/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    validateObjectId(req.params.id, 'request id');
    requireObject(req.body);
    const status = requiredString(req.body.status, 'status', { maxLength: 40 });
    if (!['approved', 'rejected'].includes(status)) {
      throw new AppError(400, 'INVALID_STATUS', 'Administrators may only approve or reject pending requests');
    }
    const adminNotes = req.body.adminNotes === undefined
      ? ''
      : optionalString(
        req.body.adminNotes,
        'adminNotes',
        { maxLength: 4000 }
      ) || '';
    const update = {
      status,
      adminNotes,
      processedDate: new Date(),
    };
    if (status === 'rejected') {
      Object.assign(update, emptyGeneratedDocument(), emptyDocuSign());
    }
    const previous = await LetterRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { $set: update },
      { new: false, runValidators: true }
    );
    if (!previous) {
      const existing = await findRequestOrThrow(LetterRequest, req.params.id);
      assertTransition(existing.status, status);
      throw new AppError(409, 'REQUEST_ALREADY_DECIDED', 'The request was already updated');
    }
    if (status === 'rejected') await deleteGeneratedDocument(previous);
    const request = await findRequestOrThrow(LetterRequest, req.params.id);
    await notifyStatusChange({ request, Employee, emailService });
    res.json({ request: safeLetterRequestDto(request) });
  }));

  router.get('/:id/download-letter', asyncHandler(async (req, res, next) => {
    validateObjectId(req.params.id, 'request id');
    const request = await findRequestOrThrow(LetterRequest, req.params.id);
    assertDocumentAccess(req.employee, request);
    await assertGeneratedFile(request);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename(request.generatedLetterFilename)}"`
    );
    const stream = fs.createReadStream(request.generatedLetterPath);
    stream.on('error', next);
    stream.pipe(res);
  }));

  router.get('/:id/preview-letter', asyncHandler(async (req, res) => {
    validateObjectId(req.params.id, 'request id');
    const request = await findRequestOrThrow(LetterRequest, req.params.id);
    assertDocumentAccess(req.employee, request);
    await assertGeneratedFile(request);
    const content = await fsp.readFile(request.generatedLetterPath);
    res.json({
      success: true,
      filename: safeFilename(request.generatedLetterFilename),
      content: content.toString('base64'),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      generatedDate: request.letterGeneratedDate,
    });
  }));

  router.post('/:id/send-to-docusign', auth.requireAdmin, asyncHandler(async (req, res) => {
    validateObjectId(req.params.id, 'request id');
    requireObject(req.body);
    const adminEmail = validateEmail(req.body.adminEmail, 'adminEmail', { required: true });
    const existing = await findRequestOrThrow(LetterRequest, req.params.id);
    if (
      existing.docusignEnvelopeId
      && ['sent_for_signing', 'signed', 'completed'].includes(existing.status)
    ) {
      return res.json({
        success: true,
        alreadySent: true,
        envelopeId: existing.docusignEnvelopeId,
        request: safeLetterRequestDto(existing),
      });
    }
    await assertGeneratedFile(existing);
    const request = await LetterRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: ['approved', 'letter_generated'] },
        docusignEnvelopeId: null,
      },
      {
        $set: {
          status: 'signing_in_progress',
          docusignOperationStartedAt: new Date(),
        },
      },
      { new: true, runValidators: true }
    );
    if (!request) {
      throw new AppError(
        409,
        'DOCUSIGN_SEND_IN_PROGRESS',
        'The request is already being sent or is no longer eligible'
      );
    }
    const previousStatus = existing.status;
    try {
      const integration = await createDocuSignEnvelope({
        request,
        adminEmail,
        admin: req.employee,
        docusignRegistry,
        config,
      });
      const sentRequest = await LetterRequest.findOneAndUpdate(
        { _id: request._id, status: 'signing_in_progress' },
        {
          $set: {
            status: 'sent_for_signing',
            docusignEnvelopeId: integration.envelopeId,
            docusignEnvelopeStatus: 'sent',
            docusignSentDate: new Date(),
          },
          $unset: { docusignOperationStartedAt: 1 },
        },
        { new: true, runValidators: true }
      );
      if (!sentRequest) {
        throw new AppError(409, 'DOCUSIGN_STATE_CHANGED', 'The request changed while sending');
      }
      return res.json({
        success: true,
        message: 'Letter sent to DocuSign for signing',
        ...integration,
        request: safeLetterRequestDto(sentRequest),
      });
    } catch (error) {
      await LetterRequest.updateOne(
        { _id: request._id, status: 'signing_in_progress', docusignEnvelopeId: null },
        {
          $set: { status: previousStatus },
          $unset: { docusignOperationStartedAt: 1 },
        }
      );
      throw error;
    }
  }));

  router.get('/:id/docusign-status', auth.requireAdmin, asyncHandler(async (req, res) => {
    validateObjectId(req.params.id, 'request id');
    const request = await findRequestOrThrow(LetterRequest, req.params.id);
    if (!request.docusignEnvelopeId) {
      throw new AppError(400, 'DOCUSIGN_ENVELOPE_MISSING', 'No DocuSign envelope is associated with this request');
    }
    const service = getAuthenticatedDocuSignService(docusignRegistry, req.employee);
    const envelope = await service.getEnvelopeStatus(request.docusignEnvelopeId);
    request.docusignEnvelopeStatus = envelope.status;
    if (envelope.status === 'completed' && canTransitionRequestStatus(request.status, 'completed')) {
      request.status = 'completed';
      request.docusignCompletedDate = new Date();
    }
    await request.save();
    res.json({
      envelopeId: request.docusignEnvelopeId,
      status: envelope.status,
      request: safeLetterRequestDto(request),
    });
  }));

  router.get('/:id/signing-url', auth.requireAdmin, asyncHandler(async (req, res) => {
    validateObjectId(req.params.id, 'request id');
    const request = await findRequestOrThrow(LetterRequest, req.params.id);
    if (!request.docusignEnvelopeId) {
      throw new AppError(400, 'DOCUSIGN_ENVELOPE_MISSING', 'No DocuSign envelope is associated with this request');
    }
    if (!req.employee.email) {
      throw new AppError(400, 'ADMIN_EMAIL_REQUIRED', 'The administrator account needs an email address');
    }
    const service = getAuthenticatedDocuSignService(docusignRegistry, req.employee);
    const signingUrl = await service.createEmbeddedSigningUrl(
      request.docusignEnvelopeId,
      req.employee.email,
      req.employee.name,
      `${config.frontendUrl}/admin/requests`,
      String(req.employee._id)
    );
    res.json({
      signingUrl,
      envelopeId: request.docusignEnvelopeId,
    });
  }));

  router.post('/:id/withdraw', asyncHandler(async (req, res) => {
    validateObjectId(req.params.id, 'request id');
    const previous = await LetterRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        employeeId: req.employee.employeeId,
        status: 'pending',
      },
      {
        $set: {
          status: 'withdrawn',
          processedDate: new Date(),
          ...emptyGeneratedDocument(),
          ...emptyDocuSign(),
        },
      },
      { new: false, runValidators: true }
    );
    if (!previous) {
      const existing = await findRequestOrThrow(LetterRequest, req.params.id);
      assertRequestOwner(req.employee, existing);
      assertTransition(existing.status, 'withdrawn');
      throw new AppError(409, 'REQUEST_STATE_CHANGED', 'The request was already updated');
    }
    await deleteGeneratedDocument(previous);
    const request = await findRequestOrThrow(LetterRequest, req.params.id);
    res.json(safeLetterRequestDto(request));
  }));

  router.put('/:id/retake', asyncHandler(async (req, res) => {
    validateObjectId(req.params.id, 'request id');
    requireObject(req.body);
    const existing = await findRequestOrThrow(LetterRequest, req.params.id);
    assertRequestOwner(req.employee, existing);
    assertResubmittable(existing.status);
    const letterType = req.body.letterType === undefined
      ? existing.letterType
      : requiredString(req.body.letterType, 'letterType', { maxLength: 120 });
    const template = await findActiveTemplate(LetterTemplate, letterType);
    const details = req.body.details === undefined
      ? existing.details
      : sanitizeDetails(req.body.details);
    const update = {
      letterType,
      details: validateTemplateDetails(details, template.fields),
      address: existing.address || '',
      employeeComments: existing.employeeComments || '',
      status: 'pending',
      requestDate: new Date(),
      processedDate: null,
      adminNotes: '',
      ...emptyGeneratedDocument(),
      ...emptyDocuSign(),
    };
    if (req.body.address !== undefined) {
      update.address = optionalString(req.body.address, 'address', { maxLength: 2000 }) || '';
    }
    if (req.body.employeeComments !== undefined) {
      update.employeeComments = optionalString(
        req.body.employeeComments,
        'employeeComments',
        { maxLength: 4000 }
      ) || '';
    }
    const request = await LetterRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        employeeId: req.employee.employeeId,
        status: existing.status,
      },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!request) {
      throw new AppError(409, 'REQUEST_STATE_CHANGED', 'The request was already updated');
    }
    await deleteGeneratedDocument(existing);

    let warning;
    try {
      await generateLetter({ request, letterGenerator });
    } catch {
      warning = 'The request was resubmitted, but its document could not be generated.';
    }
    const body = { request: safeLetterRequestDto(request) };
    if (warning) body.warning = warning;
    res.json(body);
  }));

  return router;
}

async function findActiveTemplate(LetterTemplate, letterType) {
  const template = await LetterTemplate.findOne({ value: letterType, isActive: true }).lean();
  if (!template) {
    throw new AppError(
      400,
      'LETTER_TYPE_UNAVAILABLE',
      'The selected letter type is not available'
    );
  }
  return template;
}

function validateTemplateDetails(details, fields = []) {
  const sanitized = sanitizeDetails(details);
  const fieldMap = new Map(fields.map((field) => [field.name, field]));
  for (const key of Object.keys(sanitized)) {
    if (!fieldMap.has(key)) {
      throw new AppError(400, 'VALIDATION_ERROR', `details.${key} is not defined by the template`);
    }
  }

  const validated = {};
  for (const field of fields) {
    const value = sanitized[field.name];
    const missing = value === undefined || value === null || value === '';
    if (missing) {
      if (field.required !== false) {
        throw new AppError(400, 'VALIDATION_ERROR', `${field.label || field.name} is required`);
      }
      continue;
    }
    if (field.type === 'number') {
      if (!['string', 'number'].includes(typeof value)) {
        throw new AppError(400, 'VALIDATION_ERROR', `${field.label || field.name} must be a number`);
      }
      const number = Number(value);
      if (!Number.isFinite(number)) {
        throw new AppError(400, 'VALIDATION_ERROR', `${field.label || field.name} must be a number`);
      }
      validated[field.name] = number;
    } else if (field.type === 'date') {
      const isIsoDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
      const date = isIsoDate ? new Date(`${value}T00:00:00Z`) : null;
      if (
        !date
        || Number.isNaN(date.getTime())
        || date.toISOString().slice(0, 10) !== value
      ) {
        throw new AppError(400, 'VALIDATION_ERROR', `${field.label || field.name} must be a date`);
      }
      validated[field.name] = value;
    } else if (field.type === 'email') {
      validated[field.name] = validateEmail(value, `details.${field.name}`, { required: true });
    } else {
      if (typeof value !== 'string') {
        throw new AppError(400, 'VALIDATION_ERROR', `${field.label || field.name} must be text`);
      }
      validated[field.name] = value;
    }
  }
  return validated;
}

async function deleteGeneratedDocument(request) {
  if (!request.generatedLetterPath) return;
  try {
    await fsp.unlink(request.generatedLetterPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new AppError(500, 'DOCUMENT_DELETE_FAILED', 'The previous letter could not be removed');
    }
  }
}

function assertResubmittable(status) {
  if (!['rejected', 'withdrawn'].includes(status)) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `Letter request status cannot change from ${status} to pending`
    );
  }
}

function parseEmployeeRequestInput(body) {
  return {
    letterType: requiredString(body.letterType, 'letterType', { maxLength: 120 }),
    details: sanitizeDetails(body.details),
    address: optionalString(body.address, 'address', { maxLength: 2000 }) || '',
    employeeComments: optionalString(
      body.employeeComments ?? body.comments,
      'employeeComments',
      { maxLength: 4000 }
    ) || '',
  };
}

async function generateLetter({ request, letterGenerator }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = safeFilename(`${request.letterType}_${request.employeeId}_${timestamp}.docx`);
  const filePath = await letterGenerator.generateAndSaveLetter(
    request.letterType,
    {
      employeeId: request.employeeId,
      employeeName: request.employeeName,
      letterType: request.letterType,
      requestDate: request.requestDate,
      details: request.details || {},
      address: request.address || '',
      employeeComments: request.employeeComments || '',
    },
    filename
  );
  request.generatedLetterPath = filePath;
  request.generatedLetterFilename = filename;
  request.letterGeneratedDate = new Date();
  await request.save();
}

async function createDocuSignEnvelope({
  request,
  adminEmail,
  admin,
  docusignRegistry,
  config,
}) {
  const service = getAuthenticatedDocuSignService(docusignRegistry, admin);
  await assertGeneratedFile(request);
  const content = await fsp.readFile(request.generatedLetterPath);
  const result = await service.sendEnvelopeForEmbeddedSigning({
    signerEmail: adminEmail,
    signerName: admin.name,
    signerClientId: String(admin._id),
    docFile: content.toString('base64'),
    documentName: safeFilename(request.generatedLetterFilename),
    emailSubject: `Please sign ${request.employeeName}'s ${request.letterType} letter`,
    transactionId: String(request._id),
    dsReturnUrl: `${config.frontendUrl}/admin/requests`,
  });
  return { envelopeId: result.envelopeId, redirectUrl: result.redirectUrl };
}

function getAuthenticatedDocuSignService(registry, employee) {
  const service = registry.getForEmployee(String(employee._id));
  if (!service.isAuthenticated()) {
    throw new AppError(503, 'DOCUSIGN_UNAVAILABLE', 'DocuSign is not connected');
  }
  return service;
}

async function notifyStatusChange({ request, Employee, emailService }) {
  if (!['approved', 'rejected'].includes(request.status)) return;
  const employee = await Employee.findOne({ employeeId: request.employeeId });
  if (!employee?.email) return;
  const data = {
    employeeId: request.employeeId,
    employeeName: request.employeeName,
    employeeEmail: employee.email,
    letterType: request.letterType,
  };
  if (request.status === 'approved') {
    await emailService.sendLetterApprovalNotification(data);
  } else {
    await emailService.sendLetterRejectionNotification(data, undefined, request.adminNotes);
  }
}

async function getNotificationEmail(Setting, fallbackEmail = '') {
  const setting = await Setting.findOne({ key: 'notifications' }).lean();
  return setting?.value?.adminEmail || fallbackEmail || '';
}

async function findRequestOrThrow(LetterRequest, id) {
  const request = await LetterRequest.findById(id);
  if (!request) {
    throw new AppError(404, 'REQUEST_NOT_FOUND', 'Letter request not found');
  }
  return request;
}

function assertDocumentAccess(employee, request) {
  if (employee.role === 'admin') return;
  assertRequestOwner(employee, request);
  if (!['approved', 'completed'].includes(request.status)) {
    throw new AppError(
      403,
      'DOCUMENT_NOT_RELEASED',
      'The letter is not available until the request is approved'
    );
  }
}

function assertRequestOwner(employee, request) {
  if (String(employee.employeeId) !== String(request.employeeId)) {
    throw new AppError(403, 'FORBIDDEN', 'You may only access your own letter requests');
  }
}

function assertTransition(from, to) {
  if (!canTransitionRequestStatus(from, to)) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `Letter request status cannot change from ${from} to ${to}`
    );
  }
}

async function assertGeneratedFile(request) {
  if (!request.generatedLetterPath) {
    throw new AppError(400, 'DOCUMENT_MISSING', 'No generated letter is available');
  }
  try {
    await fsp.access(request.generatedLetterPath);
  } catch {
    throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'The generated letter file was not found');
  }
}

function safeFilename(filename) {
  return String(filename || 'letter.docx').replace(/[^A-Za-z0-9._-]/g, '_');
}


function emptyGeneratedDocument() {
  return {
    generatedLetterPath: null,
    generatedLetterFilename: null,
    letterGeneratedDate: null,
  };
}

function emptyDocuSign() {
  return {
    docusignEnvelopeId: null,
    docusignEnvelopeStatus: null,
    docusignSigningUrl: null,
    docusignTemplateId: null,
    docusignSentDate: null,
    docusignOperationStartedAt: null,
    docusignCompletedDate: null,
  };
}

module.exports = {
  assertTransition,
  createLetterRequestsRouter,
  parseEmployeeRequestInput,
  validateTemplateDetails,
};
