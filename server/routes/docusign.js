const express = require('express');
const { AppError, asyncHandler } = require('../middleware/errors');
const {
  optionalString,
  requireObject,
  requiredString,
} = require('../utils/validation');

function createDocuSignRouter({ auth, docusignRegistry, config }) {
  const router = express.Router();

  // DocuSign redirects here without Bridge's bearer token. The one-time state is
  // validated and consumed by the server-side registry before any token exchange.
  router.get('/callback', asyncHandler(async (req, res) => {
    const code = requiredString(req.query.code, 'code', { maxLength: 4000 });
    const state = requiredString(req.query.state, 'state', { maxLength: 256 });
    await docusignRegistry.completeOAuth({ code, state });
    const redirect = new URL('/admin/integrations', config.frontendUrl);
    redirect.searchParams.set('success', 'true');
    res.redirect(redirect.toString());
  }));

  // Provider health pings carry no trusted state and intentionally expose no data.
  router.post('/ping', (req, res) => res.status(204).end());

  router.use(auth.requireAuth, auth.requireAdmin);

  router.get('/auth', asyncHandler(async (req, res) => {
    const service = serviceFor(docusignRegistry, req.employee);
    try {
      await service.authenticateWithJWT();
      return res.json({
        success: true,
        method: 'JWT',
        accountId: service.getCurrentAccountId(),
      });
    } catch {
      const { authUrl } = docusignRegistry.beginOAuth(String(req.employee._id));
      return res.json({
        success: false,
        method: 'OAuth',
        fallback: true,
        authUrl,
      });
    }
  }));

  router.post('/auth/jwt', asyncHandler(async (req, res) => {
    const service = serviceFor(docusignRegistry, req.employee);
    try {
      await service.authenticateWithJWT();
      res.json({
        success: true,
        method: 'JWT',
        accountId: service.getCurrentAccountId(),
      });
    } catch (error) {
      if (error?.type === 'consent_required') {
        throw new AppError(
          403,
          'DOCUSIGN_CONSENT_REQUIRED',
          'DocuSign consent is required',
          { consentUrl: error.consentUrl, scopes: error.scopes }
        );
      }
      throw new AppError(503, 'DOCUSIGN_UNAVAILABLE', 'DocuSign authentication is unavailable');
    }
  }));

  router.get('/consent-url', asyncHandler(async (req, res) => {
    const service = serviceFor(docusignRegistry, req.employee);
    res.json({
      consentUrl: service.getConsentUrl(),
      scopes: `${service.scopes} impersonation`,
    });
  }));

  router.get('/status', asyncHandler(async (req, res) => {
    const service = serviceFor(docusignRegistry, req.employee);
    res.json({
      authenticated: Boolean(service.isAuthenticated()),
      accountId: service.isAuthenticated() ? service.getCurrentAccountId() : null,
    });
  }));

  router.get('/templates', withService(docusignRegistry, async (service, req, res) => {
    res.json(await service.getTemplates());
  }));

  router.get('/templates/:id', withService(docusignRegistry, async (service, req, res) => {
    const id = requiredString(req.params.id, 'template id', { maxLength: 200 });
    res.json(await service.getTemplate(id));
  }));

  router.post('/templates', withService(docusignRegistry, async (service, req, res) => {
    requireObject(req.body);
    const input = {
      name: requiredString(req.body.name, 'name', { maxLength: 160 }),
      description: optionalString(req.body.description, 'description', { maxLength: 1000 }) || '',
      shared: Boolean(req.body.shared),
    };
    res.status(201).json(await service.createTemplate(input));
  }));

  router.put('/templates/:id', withService(docusignRegistry, async (service, req, res) => {
    requireObject(req.body);
    const id = requiredString(req.params.id, 'template id', { maxLength: 200 });
    const input = {
      name: requiredString(req.body.name, 'name', { maxLength: 160 }),
      description: optionalString(req.body.description, 'description', { maxLength: 1000 }) || '',
      shared: Boolean(req.body.shared),
    };
    res.json(await service.updateTemplate(id, input));
  }));

  router.delete('/templates/:id', withService(docusignRegistry, async (service, req, res) => {
    const id = requiredString(req.params.id, 'template id', { maxLength: 200 });
    res.json(await service.deleteTemplate(id));
  }));

  router.get('/envelopes', withService(docusignRegistry, async (service, req, res) => {
    const status = optionalString(req.query.status, 'status', { maxLength: 40 }) || 'any';
    const fromDate = optionalString(req.query.fromDate, 'fromDate', { maxLength: 40 });
    res.json(await service.listEnvelopes(status, fromDate));
  }));

  router.get('/envelopes/:id', withService(docusignRegistry, async (service, req, res) => {
    const id = requiredString(req.params.id, 'envelope id', { maxLength: 200 });
    res.json(await service.getEnvelopeStatus(id));
  }));

  router.post('/envelopes', withService(docusignRegistry, async (service, req, res) => {
    requireObject(req.body);
    const templateId = requiredString(req.body.templateId, 'templateId', { maxLength: 200 });
    const envelopeData = requireObject(req.body.envelopeData, 'envelopeData');
    res.status(201).json(await service.createEnvelopeFromTemplate(templateId, envelopeData));
  }));

  router.post(
    '/envelopes/embedded-signing',
    withService(docusignRegistry, async (service, req, res) => {
      requireObject(req.body);
      const envelopeArgs = {
        signerEmail: requiredString(req.body.signerEmail, 'signerEmail', { maxLength: 254 }),
        signerName: requiredString(req.body.signerName, 'signerName', { maxLength: 160 }),
        signerClientId: String(req.employee._id),
        docFile: requiredString(req.body.docFile, 'docFile', { maxLength: 8 * 1024 * 1024 }),
        documentName: optionalString(req.body.documentName, 'documentName', { maxLength: 255 })
          || 'document.pdf',
        emailSubject: optionalString(req.body.emailSubject, 'emailSubject', { maxLength: 255 })
          || 'Please sign this document',
        anchorString: optionalString(req.body.anchorString, 'anchorString', { maxLength: 100 })
          || '/sn1/',
        dsReturnUrl: `${config.frontendUrl}/admin/integrations`,
      };
      res.status(201).json(await service.sendEnvelopeForEmbeddedSigning(envelopeArgs));
    })
  );

  router.get(
    '/envelopes/:id/details',
    withService(docusignRegistry, async (service, req, res) => {
      const id = requiredString(req.params.id, 'envelope id', { maxLength: 200 });
      res.json(await service.getEnvelopeDetails(id));
    })
  );

  router.patch(
    '/envelopes/:id/status',
    withService(docusignRegistry, async (service, req, res) => {
      requireObject(req.body);
      const id = requiredString(req.params.id, 'envelope id', { maxLength: 200 });
      const status = requiredString(req.body.status, 'status', { maxLength: 40 });
      if (!['created', 'sent', 'voided', 'deleted'].includes(status)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Unsupported DocuSign envelope status');
      }
      res.json(await service.updateEnvelopeStatus(id, status));
    })
  );

  router.get(
    '/envelopes/:id/documents',
    withService(docusignRegistry, async (service, req, res) => {
      const id = requiredString(req.params.id, 'envelope id', { maxLength: 200 });
      const document = await service.getEnvelopeDocuments(id);
      res.type('application/pdf').send(document);
    })
  );

  router.post(
    '/envelopes/:id/signing-url',
    withService(docusignRegistry, async (service, req, res) => {
      requireObject(req.body);
      const id = requiredString(req.params.id, 'envelope id', { maxLength: 200 });
      const recipientEmail = requiredString(
        req.body.recipientEmail,
        'recipientEmail',
        { maxLength: 254 }
      );
      const recipientName = requiredString(
        req.body.recipientName,
        'recipientName',
        { maxLength: 160 }
      );
      const signingUrl = await service.createEmbeddedSigningUrl(
        id,
        recipientEmail,
        recipientName,
        `${config.frontendUrl}/admin/integrations`
      );
      res.json({ signingUrl });
    })
  );

  router.post('/logout', (req, res) => {
    docusignRegistry.clear(String(req.employee._id));
    res.json({ success: true, message: 'Disconnected from DocuSign' });
  });

  return router;
}

function withService(registry, handler) {
  return asyncHandler(async (req, res) => {
    const service = serviceFor(registry, req.employee);
    if (!service.isAuthenticated()) {
      throw new AppError(503, 'DOCUSIGN_UNAVAILABLE', 'DocuSign is not connected');
    }
    try {
      return await handler(service, req, res);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'DOCUSIGN_ERROR', 'DocuSign could not complete the operation');
    }
  });
}

function serviceFor(registry, employee) {
  return registry.getForEmployee(String(employee._id));
}

module.exports = { createDocuSignRouter };
