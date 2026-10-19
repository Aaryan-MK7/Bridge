const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;
const { safeLetterRequestDto } = require('../domain/letterRequests');
const {
  REQUEST_STATUSES,
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
    if (!REQUEST_STATUSES.includes(status)) {
      throw new AppError(400, 'INVALID_STATUS', 'Unknown letter request status');
    }
    const request = await findRequestOrThrow(LetterRequest, req.params.id);
    assertTransition(request.status, status);

    request.status = status;
    if (req.body.adminNotes !== undefined) {
      request.adminNotes = optionalString(
        req.body.adminNotes,
        'adminNotes',
        { maxLength: 4000 }
      ) || '';
    }
    if (status !== 'pending') request.processedDate = new Date();
    await request.save();

    let integration;
    const adminEmail = req.body.adminEmail
      ? validateEmail(req.body.adminEmail, 'adminEmail', { required: true })
      : undefined;
    if (status === 'approved' && adminEmail) {
      integration = await trySendToDocuSign({
        request,
        adminEmail,
        admin: req.employee,
        docusignRegistry,
        config,
      });
    }

    await notifyStatusChange({ request, Employee, emailService, adminEmail });
    const body = { request: safeLetterRequestDto(request) };
    if (integration) body.integration = integration;
    res.json(body);
  }));

  router.get('/:id/download-letter', asyncHandler(async (req, res, next) => {
    validateObjectId(req.params.id, 'request id');
    const request = await findRequestOrThrow(LetterRequest, req.params.id);
    assertRequestAccess(req.employee, request);
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
    assertRequestAccess(req.employee, request);
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
    const request = await findRequestOrThrow(LetterRequest, req.params.id);
    if (!['approved', 'letter_generated'].includes(request.status)) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        'The request must be approved or have a generated letter before sending'
      );
    }
    await assertGeneratedFile(request);

    const integration = await sendToDocuSign({
      request,
      adminEmail,
      admin: req.employee,
      docusignRegistry,
      config,
    });
    res.json({
      success: true,
      message: 'Letter sent to DocuSign for signing',
      ...integration,
      request: safeLetterRequestDto(request),
    });
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
      `${config.frontendUrl}/admin/requests`
    );
    res.json({
      signingUrl,
      envelopeId: request.docusignEnvelopeId,
    });
  }));

  router.post('/:id/withdraw', asyncHandler(async (req, res) => {
    validateObjectId(req.params.id, 'request id');
    const request = await findRequestOrThrow(LetterRequest, req.params.id);
    assertRequestOwner(req.employee, request);
    assertTransition(request.status, 'withdrawn');
    request.status = 'withdrawn';
    request.processedDate = new Date();
    await request.save();
    res.json(safeLetterRequestDto(request));
  }));

  router.put('/:id/retake', asyncHandler(async (req, res) => {
    validateObjectId(req.params.id, 'request id');
    requireObject(req.body);
    const request = await findRequestOrThrow(LetterRequest, req.params.id);
    assertRequestOwner(req.employee, request);
    assertTransition(request.status, 'pending');

    if (req.body.letterType !== undefined) {
      request.letterType = requiredString(req.body.letterType, 'letterType', { maxLength: 120 });
    }
    if (req.body.details !== undefined) request.details = sanitizeDetails(req.body.details);
    if (req.body.address !== undefined) {
      request.address = optionalString(req.body.address, 'address', { maxLength: 2000 }) || '';
    }
    if (req.body.employeeComments !== undefined) {
      request.employeeComments = optionalString(
        req.body.employeeComments,
        'employeeComments',
        { maxLength: 4000 }
      ) || '';
    }
    request.status = 'pending';
    request.requestDate = new Date();
    request.processedDate = null;
    request.adminNotes = '';
    clearGeneratedDocument(request);
    clearDocuSign(request);
    await request.save();

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

async function trySendToDocuSign(args) {
  try {
    if (!args.request.generatedLetterPath) {
      return { docusign: 'unavailable', message: 'No generated document is available.' };
    }
    return { docusign: 'sent', ...(await sendToDocuSign(args)) };
  } catch (error) {
    return {
      docusign: 'unavailable',
      message: error instanceof AppError
        ? error.message
        : 'DocuSign is currently unavailable; the request remains approved.',
    };
  }
}

async function sendToDocuSign({
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
    anchorString: '/sn1/',
    dsReturnUrl: `${config.frontendUrl}/admin/requests`,
  });

  assertTransition(request.status, 'sent_for_signing');
  request.status = 'sent_for_signing';
  request.docusignEnvelopeId = result.envelopeId;
  request.docusignEnvelopeStatus = 'sent';
  request.docusignSentDate = new Date();
  await request.save();
  return { envelopeId: result.envelopeId, redirectUrl: result.redirectUrl };
}

function getAuthenticatedDocuSignService(registry, employee) {
  const service = registry.getForEmployee(String(employee._id));
  if (!service.isAuthenticated()) {
    throw new AppError(503, 'DOCUSIGN_UNAVAILABLE', 'DocuSign is not connected');
  }
  return service;
}

async function notifyStatusChange({ request, Employee, emailService, adminEmail }) {
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
    await emailService.sendLetterApprovalNotification(data, adminEmail);
  } else {
    await emailService.sendLetterRejectionNotification(data, adminEmail, request.adminNotes);
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

function assertRequestAccess(employee, request) {
  if (employee.role !== 'admin') assertRequestOwner(employee, request);
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

function clearGeneratedDocument(request) {
  request.generatedLetterPath = null;
  request.generatedLetterFilename = null;
  request.letterGeneratedDate = null;
}

function clearDocuSign(request) {
  request.docusignEnvelopeId = null;
  request.docusignEnvelopeStatus = null;
  request.docusignSigningUrl = null;
  request.docusignTemplateId = null;
  request.docusignSentDate = null;
  request.docusignCompletedDate = null;
}

module.exports = {
  assertTransition,
  createLetterRequestsRouter,
  parseEmployeeRequestInput,
};
