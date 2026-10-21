const assert = require('node:assert/strict');
const test = require('node:test');
const DocuSignService = require('../services/docusignService');

test('embedded envelopes preserve the generated document extension', () => {
  const service = new DocuSignService();
  const envelope = service.makeEnvelope({
    signerEmail: 'admin@example.com',
    signerName: 'Bridge Administrator',
    signerClientId: 'admin-id',
    docFile: Buffer.from('document').toString('base64'),
    documentName: 'visa_EMP-001.docx',
    transactionId: 'request-id',
  });

  assert.equal(envelope.documents[0].fileExtension, 'docx');
  assert.equal(envelope.transactionId, 'request-id');
  assert.equal(envelope.recipients.signers[0].clientUserId, 'admin-id');
  assert.equal(envelope.recipients.signers[0].tabs.signHereTabs[0].documentId, '1');
  assert.equal(envelope.recipients.signers[0].tabs.signHereTabs[0].pageNumber, '1');
});

test('recipient views retain the exact return URL and client identity', () => {
  const service = new DocuSignService();
  const view = service.makeRecipientViewRequest({
    dsReturnUrl: 'https://bridge.example.com/admin/requests',
    signerEmail: 'admin@example.com',
    signerName: 'Bridge Administrator',
    signerClientId: 'admin-id',
  });

  assert.equal(view.returnUrl, 'https://bridge.example.com/admin/requests');
  assert.equal(view.clientUserId, 'admin-id');
});

test('consent URLs encode the required OAuth scopes', () => {
  const service = new DocuSignService();
  const consentUrl = new URL(service.getConsentUrl());

  assert.equal(consentUrl.pathname, '/oauth/auth');
  assert.equal(consentUrl.searchParams.get('response_type'), 'code');
  assert.equal(consentUrl.searchParams.get('scope'), 'signature impersonation');
});
