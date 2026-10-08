const express = require('express');
const router = express.Router();
const DocuSignService = require('../services/docusignService');
const crypto = require('crypto');

// Store DocuSign service instances per session
const docusignServices = new Map();

// Middleware to get or create DocuSign service for session
const getDocuSignService = (req, res, next) => {
  const sessionId = req.session.id || 'default';

  if (!docusignServices.has(sessionId)) {
    docusignServices.set(sessionId, new DocuSignService());
  }

  req.docusignService = docusignServices.get(sessionId);
  next();
};

// Get OAuth authorization URL
router.get('/auth', getDocuSignService, async (req, res) => {
  try {
    // Try JWT authentication first
    try {
      console.log('🔐 Auth - Attempting JWT authentication...');
      await req.docusignService.authenticateWithJWT();

      // If JWT succeeds, return success
      res.json({
        success: true,
        message: 'Successfully authenticated with JWT',
        method: 'JWT',
        accountId: req.docusignService.getCurrentAccountId()
      });
    } catch (jwtError) {
      console.log('🔐 Auth - JWT failed, falling back to OAuth:', jwtError.message);

      // Fallback to OAuth
      const { authUrl, state } = req.docusignService.getAuthUrl();

      // Store state in session for verification
      req.session.docusignState = state;

      // Debug logging
      console.log('🔐 OAuth Auth - Generated state:', state);
      console.log('🔐 OAuth Auth - Session ID:', req.session.id);
      console.log('🔐 OAuth Auth - Stored state in session:', req.session.docusignState);

      res.json({
        authUrl,
        state,
        method: 'OAuth',
        fallback: true
      });
    }
  } catch (error) {
    console.error('Error in auth:', error);
    res.status(500).json({ error: error.message });
  }
});

// New JWT authentication endpoint
router.post('/auth/jwt', getDocuSignService, async (req, res) => {
  try {
    console.log('🔐 JWT Auth - Direct JWT authentication request');

    await req.docusignService.authenticateWithJWT();

    // Store authentication info in session
    req.session.docusignAuthenticated = true;
    req.session.docusignAccessToken = req.docusignService.getAccessToken();
    req.session.docusignAccountId = req.docusignService.getCurrentAccountId();
    req.session.docusignMethod = 'JWT';

    res.json({
      success: true,
      message: 'Successfully authenticated with JWT',
      method: 'JWT',
      accountId: req.session.docusignAccountId
    });
  } catch (error) {
    console.error('JWT authentication error:', error);

    // Handle consent required error
    if (error.type === 'consent_required') {
      res.status(403).json({
        error: 'consent_required',
        message: error.message,
        consentUrl: error.consentUrl,
        scopes: error.scopes,
        instructions: 'User consent is required. Please visit the consent URL to grant permissions.'
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get consent URL for JWT authentication
router.get('/consent-url', getDocuSignService, (req, res) => {
  try {
    const consentUrl = req.docusignService.getConsentUrl();
    res.json({
      consentUrl,
      scopes: req.docusignService.scopes + ' impersonation',
      instructions: 'Visit this URL to grant consent for JWT authentication'
    });
  } catch (error) {
    console.error('Error getting consent URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// OAuth callback
router.get('/callback', getDocuSignService, async (req, res) => {
  try {
    const { code, state } = req.query;

    // Debug logging
    console.log('🔐 OAuth Callback - Received state:', state);
    console.log('🔐 OAuth Callback - Session ID:', req.session.id);
    console.log('🔐 OAuth Callback - Stored state in session:', req.session.docusignState);
    console.log('🔐 OAuth Callback - Session data:', JSON.stringify(req.session, null, 2));

    // Verify state parameter
    if (state !== req.session.docusignState) {
      console.log('❌ State mismatch!');
      console.log('   Received state:', state);
      console.log('   Stored state:', req.session.docusignState);
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    // Exchange code for access token
    const tokenData = await req.docusignService.getAccessToken(code);

    console.log('🔐 Callback - Token data received:', JSON.stringify(tokenData, null, 2));

    if (!tokenData || !tokenData.access_token) {
      console.error('❌ Callback - No access token in tokenData');
      return res.status(400).json({ error: 'Failed to get access token from DocuSign' });
    }

    // Store authentication info in session
    req.session.docusignAuthenticated = true;
    req.session.docusignAccessToken = tokenData.access_token;
    req.session.docusignAccountId = req.docusignService.getCurrentAccountId();

    // Clear state
    delete req.session.docusignState;

    res.json({
      success: true,
      message: 'Successfully authenticated with DocuSign',
      accountId: req.session.docusignAccountId
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check authentication status
router.get('/status', getDocuSignService, (req, res) => {
  try {
    const isAuthenticated = req.docusignService.isAuthenticated() || req.session.docusignAuthenticated;

    // Debug logging
    console.log('🔐 Status Check - Session ID:', req.session.id);
    console.log('🔐 Status Check - Session data:', JSON.stringify(req.session, null, 2));

    res.json({
      authenticated: isAuthenticated,
      accountId: req.session.docusignAccountId || req.docusignService.getCurrentAccountId(),
      sessionId: req.session.id,
      sessionData: req.session
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get templates from DocuSign
router.get('/templates', getDocuSignService, async (req, res) => {
  try {
    const templates = await req.docusignService.getTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get template by ID
router.get('/templates/:id', getDocuSignService, async (req, res) => {
  try {
    const template = await req.docusignService.getTemplate(req.params.id);
    res.json(template);
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new template
router.post('/templates', getDocuSignService, async (req, res) => {
  try {
    const template = await req.docusignService.createTemplate(req.body);
    res.json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update template
router.put('/templates/:id', getDocuSignService, async (req, res) => {
  try {
    const template = await req.docusignService.updateTemplate(req.params.id, req.body);
    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete template
router.delete('/templates/:id', getDocuSignService, async (req, res) => {
  try {
    const result = await req.docusignService.deleteTemplate(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get envelopes
router.get('/envelopes', getDocuSignService, async (req, res) => {
  try {
    const { status, fromDate } = req.query;
    const envelopes = await req.docusignService.listEnvelopes(status, fromDate);
    res.json(envelopes);
  } catch (error) {
    console.error('Error listing envelopes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get envelope by ID
router.get('/envelopes/:id', getDocuSignService, async (req, res) => {
  try {
    const envelope = await req.docusignService.getEnvelopeStatus(req.params.id);
    res.json(envelope);
  } catch (error) {
    console.error('Error getting envelope:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create envelope from template
router.post('/envelopes', getDocuSignService, async (req, res) => {
  try {
    const { templateId, envelopeData } = req.body;
    const envelope = await req.docusignService.createEnvelopeFromTemplate(templateId, envelopeData);
    res.json(envelope);
  } catch (error) {
    console.error('Error creating envelope:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send envelope for embedded signing
router.post('/envelopes/embedded-signing', getDocuSignService, async (req, res) => {
  try {
    const envelopeArgs = req.body;

    // Validate required fields
    if (!envelopeArgs.signerEmail || !envelopeArgs.signerName || !envelopeArgs.docFile) {
      return res.status(400).json({
        error: 'Missing required fields: signerEmail, signerName, docFile'
      });
    }

    // Add return URL and ping URL if not provided
    if (!envelopeArgs.dsReturnUrl) {
      envelopeArgs.dsReturnUrl = `${req.protocol}://${req.get('host')}/docusign/callback`;
    }
    if (!envelopeArgs.dsPingUrl) {
      envelopeArgs.dsPingUrl = `${req.protocol}://${req.get('host')}/docusign/ping`;
    }

    const result = await req.docusignService.sendEnvelopeForEmbeddedSigning(envelopeArgs);
    res.json(result);
  } catch (error) {
    console.error('Error sending envelope for embedded signing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get envelope details
router.get('/envelopes/:id/details', getDocuSignService, async (req, res) => {
  try {
    const envelope = await req.docusignService.getEnvelopeDetails(req.params.id);
    res.json(envelope);
  } catch (error) {
    console.error('Error getting envelope details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update envelope status
router.patch('/envelopes/:id/status', getDocuSignService, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const result = await req.docusignService.updateEnvelopeStatus(req.params.id, status);
    res.json(result);
  } catch (error) {
    console.error('Error updating envelope status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get envelope documents
router.get('/envelopes/:id/documents', getDocuSignService, async (req, res) => {
  try {
    const documents = await req.docusignService.getEnvelopeDocuments(req.params.id);
    res.json(documents);
  } catch (error) {
    console.error('Error getting envelope documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create embedded signing URL
router.post('/envelopes/:id/signing-url', getDocuSignService, async (req, res) => {
  try {
    const { recipientEmail, recipientName, returnUrl } = req.body;
    const signingUrl = await req.docusignService.createEmbeddedSigningUrl(
      req.params.id,
      recipientEmail,
      recipientName,
      returnUrl
    );
    res.json({ signingUrl });
  } catch (error) {
    console.error('Error creating signing URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check session
router.get('/debug-session', (req, res) => {
  try {
    // Test setting a value in session
    req.session.testValue = 'test-' + Date.now();

    res.json({
      sessionId: req.session.id,
      sessionData: req.session,
      cookies: req.headers.cookie,
      userAgent: req.headers['user-agent'],
      testValueSet: req.session.testValue
    });
  } catch (error) {
    console.error('Debug session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test session persistence
router.get('/test-session', (req, res) => {
  try {
    const testValue = req.session.testValue || 'NOT_SET';
    res.json({
      sessionId: req.session.id,
      testValue: testValue,
      sessionData: req.session
    });
  } catch (error) {
    console.error('Test session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Logout from DocuSign
router.post('/logout', getDocuSignService, async (req, res) => {
  try {
    req.docusignService.clearToken();

    // Clear session
    req.session.docusignAuthenticated = false;
    req.session.docusignAccessToken = null;
    req.session.docusignAccountId = null;
    req.session.docusignMethod = null;

    res.json({ success: true, message: 'Successfully logged out from DocuSign' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: error.message });
  }
});

// Callback route for embedded signing completion
router.get('/callback', (req, res) => {
  try {
    const { envelopeId, event, state } = req.query;

    console.log('🔐 DocuSign Callback - Envelope:', envelopeId, 'Event:', event, 'State:', state);

    // Store completion info in session for frontend to access
    req.session.docusignCallback = {
      envelopeId,
      event,
      state,
      timestamp: new Date().toISOString()
    };

    // Redirect to frontend with success message
    res.redirect(`${process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173'}/docusign/signing-complete?envelopeId=${envelopeId}&event=${event}`);
  } catch (error) {
    console.error('Error in DocuSign callback:', error);
    res.status(500).send('Error processing callback');
  }
});

// Ping route for DocuSign to communicate with our app
router.post('/ping', (req, res) => {
  try {
    const { envelopeId, event } = req.body;

    console.log('🔐 DocuSign Ping - Envelope:', envelopeId, 'Event:', event);

    // You can implement real-time updates here
    // For example, emit to WebSocket clients or update database

    res.json({
      success: true,
      message: 'Ping received',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in DocuSign ping:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get callback information
router.get('/callback-info', (req, res) => {
  try {
    const callbackInfo = req.session.docusignCallback;
    if (callbackInfo) {
      res.json(callbackInfo);
      // Clear the callback info after sending
      delete req.session.docusignCallback;
    } else {
      res.json({ message: 'No callback information available' });
    }
  } catch (error) {
    console.error('Error getting callback info:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
