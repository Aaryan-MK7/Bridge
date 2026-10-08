const express = require('express');
const router = express.Router();
const LetterRequest = require('../models/LetterRequest');
const Employee = require('../models/Employee');
const DocuSignService = require('../services/docusignService');
const LetterGeneratorService = require('../services/letterGeneratorService');
const EmailService = require('../services/emailService');

// Store DocuSign service instances per session
const docusignServices = new Map();

// Initialize services
const letterGenerator = new LetterGeneratorService();
const emailService = new EmailService();

// Middleware to get or create DocuSign service for session
const getDocuSignService = (req, res, next) => {
  const sessionId = req.session.id || 'default';

  if (!docusignServices.has(sessionId)) {
    docusignServices.set(sessionId, new DocuSignService());
  }

  req.docusignService = docusignServices.get(sessionId);
  next();
};

// Submit a new letter request
router.post('/', async (req, res) => {
  try {
    const { employeeId, employeeName, letterType, details, employeeComments } = req.body;

    if (!employeeId || !employeeName || !letterType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newRequest = new LetterRequest({
      employeeId,
      employeeName,
      letterType,
      details: details || {},
      employeeComments: employeeComments || '',
    });

    // Save the request first
    await newRequest.save();

    // Automatically generate the filled letter
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${letterType}_${employeeId}_${timestamp}.docx`;

      // Generate DOCX letter with employee details
      const filePath = await letterGenerator.generateAndSaveLetter(
        letterType,
        {
          employeeId: employeeId,
          employeeName: employeeName,
          letterType: letterType,
          requestDate: newRequest.requestDate,
          details: details || {},
          employeeComments: employeeComments || ''
        },
        filename
      );

      // Update the request with generated letter info
      newRequest.generatedLetterPath = filePath;
      newRequest.generatedLetterFilename = filename;
      newRequest.letterGeneratedDate = new Date();
      await newRequest.save();

      // Send email notification to admin (you can configure the admin email)
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@company.com';
      try {
        await emailService.sendLetterRequestNotification(
          {
            employeeId,
            employeeName,
            letterType,
            requestDate: newRequest.requestDate,
            details,
            employeeComments
          },
          adminEmail
        );
      } catch (emailError) {
        console.log('Email notification failed (non-critical):', emailError.message);
      }

      res.json(newRequest);
    } catch (generationError) {
      console.error('Letter generation error:', generationError);
      // Still return the request even if letter generation fails
      res.json(newRequest);
    }

  } catch (err) {
    console.error("Backend error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Test EmailJS configuration
router.get('/test-email', async (req, res) => {
  try {
    const configStatus = emailService.getConfigurationStatus();

    if (!configStatus.fullyConfigured) {
      return res.status(400).json({
        error: 'EmailJS not fully configured',
        configStatus,
        message: 'Please check your environment variables: EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY'
      });
    }

    // Test email to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@company.com';
    const testResult = await emailService.sendLetterRequestNotification(
      {
        employeeId: 'TEST001',
        employeeName: 'Test Employee',
        letterType: 'Test Letter',
        requestDate: new Date(),
        details: { test: true },
        employeeComments: 'This is a test email to verify EmailJS configuration.'
      },
      adminEmail
    );

    res.json({
      success: true,
      message: 'Test email sent successfully',
      configStatus,
      testResult,
      adminEmail
    });

  } catch (error) {
    console.error('EmailJS test failed:', error);
    res.status(500).json({
      error: 'EmailJS test failed',
      message: error.message,
      configStatus: emailService.getConfigurationStatus()
    });
  }
});

// Get all letter requests (for admin)
router.get('/', async (req, res) => {
  try {
    const requests = await LetterRequest.find().sort({ requestDate: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get requests by employee ID
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const requests = await LetterRequest.find({
      employeeId: req.params.employeeId,
    }).sort({ requestDate: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update request status (for admin) - now includes DocuSign integration
router.patch('/:id', getDocuSignService, async (req, res) => {
  try {
    const { status, adminNotes, adminEmail } = req.body;
    const updateData = { status };
    if (adminNotes) updateData.adminNotes = adminNotes;
    if (status !== 'pending') updateData.processedDate = new Date();

    // If status is being set to approved, automatically send to DocuSign
    if (status === 'approved' && adminEmail) {
      try {
        // Check if DocuSign is authenticated
        if (!req.docusignService.isAuthenticated()) {
          return res.status(400).json({
            error: 'DocuSign not authenticated. Please connect to DocuSign first.',
            requiresDocuSignAuth: true
          });
        }

        // Get the request to access generated letter
        const request = await LetterRequest.findById(req.params.id);
        if (!request.generatedLetterPath) {
          return res.status(400).json({ error: 'No generated letter found. Please regenerate the letter.' });
        }

        // Read the generated DOCX file
        const fs = require('fs');
        const docxBuffer = fs.readFileSync(request.generatedLetterPath);
        const base64Docx = docxBuffer.toString('base64');

        // Create envelope for admin signing with the generated letter
        const envelopeArgs = {
          signerEmail: adminEmail,
          signerName: 'HR Administrator',
          signerClientId: '1000',
          docFile: base64Docx,
          documentName: request.generatedLetterFilename,
          emailSubject: `Please sign ${request.employeeName}'s ${request.letterType} letter`,
          anchorString: '/sn1/',
          dsReturnUrl: `${process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173'}/docusign/callback`,
          dsPingUrl: `${req.protocol}://${req.get('host')}/api/docusign/ping`
        };

        // Create envelope with the generated letter
        const result = await req.docusignService.sendEnvelopeForEmbeddedSigning(envelopeArgs);

        // Update the request with DocuSign information and status
        updateData.status = 'sent_for_signing';
        updateData.docusignEnvelopeId = result.envelopeId;
        updateData.docusignEnvelopeStatus = 'sent';
        updateData.docusignSentDate = new Date();

        const updatedRequest = await LetterRequest.findByIdAndUpdate(
          req.params.id,
          updateData,
          { new: true }
        );

        // Send approval notification email to employee
        try {
          await emailService.sendLetterApprovalNotification(
            {
              employeeId: request.employeeId,
              employeeName: request.employeeName,
              letterType: request.letterType,
              employeeEmail: process.env.EMPLOYEE_EMAIL || 'employee@company.com'
            },
            adminEmail
          );
        } catch (emailError) {
          console.log('Approval email notification failed (non-critical):', emailError.message);
        }

        res.json({
          success: true,
          message: 'Request approved and sent to DocuSign for admin signing',
          envelopeId: result.envelopeId,
          redirectUrl: result.redirectUrl,
          request: updatedRequest
        });

      } catch (docusignError) {
        console.error('DocuSign error:', docusignError);
        // If DocuSign fails, still approve the request but return error info
        const updatedRequest = await LetterRequest.findByIdAndUpdate(
          req.params.id,
          updateData,
          { new: true }
        );

        res.json({
          success: true,
          message: 'Request approved but failed to send to DocuSign',
          error: docusignError.message,
          request: updatedRequest
        });
      }
    } else if (status === 'rejected') {
      // Send rejection notification email to employee
      const request = await LetterRequest.findById(req.params.id);
      if (request) {
        try {
          await emailService.sendLetterRejectionNotification(
            {
              employeeId: request.employeeId,
              employeeName: request.employeeName,
              letterType: request.letterType,
              employeeEmail: process.env.EMPLOYEE_EMAIL || 'employee@company.com'
            },
            adminEmail || 'admin@company.com',
            adminNotes
          );
        } catch (emailError) {
          console.log('Rejection email notification failed (non-critical):', emailError.message);
        }
      }

      // Regular status update without DocuSign
      const updatedRequest = await LetterRequest.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );
      res.json(updatedRequest);
    } else {
      // Regular status update without DocuSign
      const updatedRequest = await LetterRequest.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );
      res.json(updatedRequest);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download generated letter
router.get('/:id/download-letter', async (req, res) => {
  try {
    const request = await LetterRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Letter request not found' });
    }

    if (!request.generatedLetterPath) {
      return res.status(400).json({ error: 'No letter has been generated yet' });
    }

    const fs = require('fs');
    if (!fs.existsSync(request.generatedLetterPath)) {
      return res.status(404).json({ error: 'Generated letter file not found' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${request.generatedLetterFilename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(request.generatedLetterPath);
    fileStream.pipe(res);

  } catch (err) {
    console.error('Error downloading letter:', err);
    res.status(500).json({ error: err.message });
  }
});

// Preview generated letter
router.get('/:id/preview-letter', async (req, res) => {
  try {
    const request = await LetterRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Letter request not found' });
    }

    if (!request.generatedLetterPath) {
      return res.status(400).json({ error: 'No letter has been generated yet' });
    }

    const fs = require('fs');
    if (!fs.existsSync(request.generatedLetterPath)) {
      return res.status(404).json({ error: 'Generated letter file not found' });
    }

    // Read the file and return as base64 for preview
    const fileBuffer = fs.readFileSync(request.generatedLetterPath);
    const base64Content = fileBuffer.toString('base64');

    res.json({
      success: true,
      filename: request.generatedLetterFilename,
      content: base64Content,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      generatedDate: request.letterGeneratedDate
    });

  } catch (err) {
    console.error('Error previewing letter:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send generated letter to DocuSign for admin signing
router.post('/:id/send-to-docusign', getDocuSignService, async (req, res) => {
  try {
    const { adminEmail } = req.body;

    if (!adminEmail) {
      return res.status(400).json({ error: 'Admin email is required' });
    }

    const request = await LetterRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Letter request not found' });
    }

    if (request.status !== 'letter_generated') {
      return res.status(400).json({ error: 'Letter must be generated before sending to DocuSign' });
    }

    if (!request.generatedLetterPath) {
      return res.status(400).json({ error: 'No generated letter found' });
    }

    // Check if DocuSign is authenticated
    if (!req.docusignService.isAuthenticated()) {
      return res.status(401).json({ error: 'DocuSign not authenticated. Please connect to DocuSign first.' });
    }

    try {
      // Read the generated DOCX file
      const fs = require('fs');
      const docxBuffer = fs.readFileSync(request.generatedLetterPath);
      const base64Docx = docxBuffer.toString('base64');

      // Create envelope for admin signing with the generated letter
      const envelopeArgs = {
        signerEmail: adminEmail,
        signerName: 'HR Administrator',
        signerClientId: '1000',
        docFile: base64Docx,
        documentName: request.generatedLetterFilename,
        emailSubject: `Please sign ${request.employeeName}'s ${request.letterType} letter`,
        anchorString: '/sn1/',
        dsReturnUrl: `${process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173'}/docusign/callback`,
        dsPingUrl: `${req.protocol}://${req.get('host')}/api/docusign/ping`
      };

      // Create envelope with the generated letter
      const result = await req.docusignService.sendEnvelopeForEmbeddedSigning(envelopeArgs);

      // Update the letter request with DocuSign information
      const updatedRequest = await LetterRequest.findByIdAndUpdate(
        req.params.id,
        {
          status: 'sent_for_signing',
          docusignEnvelopeId: result.envelopeId,
          docusignEnvelopeStatus: 'sent',
          docusignSentDate: new Date()
        },
        { new: true }
      );

      res.json({
        success: true,
        message: 'Generated letter sent to DocuSign for admin signing',
        envelopeId: result.envelopeId,
        redirectUrl: result.redirectUrl,
        request: updatedRequest
      });

    } catch (docusignError) {
      console.error('DocuSign error:', docusignError);
      res.status(500).json({
        error: 'Failed to send to DocuSign',
        details: docusignError.message
      });
    }

  } catch (err) {
    console.error('Error sending to DocuSign:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get DocuSign envelope status
router.get('/:id/docusign-status', getDocuSignService, async (req, res) => {
  try {
    const request = await LetterRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Letter request not found' });
    }

    if (!request.docusignEnvelopeId) {
      return res.status(400).json({ error: 'No DocuSign envelope associated with this request' });
    }

    // Check if DocuSign is authenticated
    if (!req.docusignService.isAuthenticated()) {
      return res.status(401).json({ error: 'DocuSign not authenticated' });
    }

    try {
      // Get envelope status from DocuSign
      const envelope = await req.docusignService.getEnvelopeStatus(request.docusignEnvelopeId);

      // Update local status if it has changed
      if (envelope.status !== request.docusignEnvelopeStatus) {
        await LetterRequest.findByIdAndUpdate(req.params.id, {
          docusignEnvelopeStatus: envelope.status,
          status: envelope.status === 'completed' ? 'completed' : request.status,
          docusignCompletedDate: envelope.status === 'completed' ? new Date() : null
        });
      }

      res.json({
        envelopeId: request.docusignEnvelopeId,
        status: envelope.status,
        request: request
      });

    } catch (docusignError) {
      console.error('DocuSign error:', docusignError);
      res.status(500).json({
        error: 'Failed to get DocuSign status',
        details: docusignError.message
      });
    }

  } catch (err) {
    console.error('Error getting DocuSign status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get DocuSign signing URL for admin
router.get('/:id/signing-url', getDocuSignService, async (req, res) => {
  try {
    const request = await LetterRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Letter request not found' });
    }

    if (!request.docusignEnvelopeId) {
      return res.status(400).json({ error: 'No DocuSign envelope associated with this request' });
    }

    // Check if DocuSign is authenticated
    if (!req.docusignService.isAuthenticated()) {
      return res.status(401).json({ error: 'DocuSign not authenticated' });
    }

    try {
      // Get the signing URL for the admin
      const signingUrl = await req.docusignService.createEmbeddedSigningUrl(
        request.docusignEnvelopeId,
        'admin@company.com', // Admin email
        'HR Administrator', // Admin name
        `${process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173'}/docusign/callback`
      );

      res.json({
        signingUrl: signingUrl,
        envelopeId: request.docusignEnvelopeId,
        message: 'Signing URL generated successfully'
      });

    } catch (docusignError) {
      console.error('DocuSign error:', docusignError);
      res.status(500).json({
        error: 'Failed to get signing URL',
        details: docusignError.message
      });
    }

  } catch (err) {
    console.error('Error getting signing URL:', err);
    res.status(500).json({ error: err.message });
  }
});

// Withdraw a pending request (employee)
router.post('/:id/withdraw', async (req, res) => {
  try {
    const request = await LetterRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be withdrawn' });
    }

    request.status = 'withdrawn';
    request.processedDate = new Date();
    await request.save();

    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retake a request (employee resubmits)
router.put('/:id/retake', async (req, res) => {
  try {
    const { letterType } = req.body;

    const updatedRequest = await LetterRequest.findByIdAndUpdate(
      req.params.id,
      {
        letterType,               // allow changing type if needed
        status: 'pending',        // reset status
        requestDate: new Date(),  // reset request date
        processedDate: null,      // clear processed date
        adminNotes: "",           // clear admin notes
        // Clear DocuSign fields when retaking
        docusignEnvelopeId: null,
        docusignEnvelopeStatus: null,
        docusignSigningUrl: null,
        docusignTemplateId: null,
        docusignSentDate: null,
        docusignCompletedDate: null
      },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.json(updatedRequest);
  } catch (err) {
    console.error("Retake error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
