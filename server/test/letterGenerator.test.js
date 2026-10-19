const assert = require('node:assert/strict');
const test = require('node:test');
const LetterGeneratorService = require('../services/letterGeneratorService');

test('document generation falls back to a valid DOCX when no template is installed', async () => {
  const generator = new LetterGeneratorService({
    templatesPath: '/bridge-smoke/missing-templates',
  });
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const buffer = await generator.generateDocxLetter('custom_letter', {
      employeeId: 'EMP-100',
      employeeName: 'Taylor Employee',
      letterType: 'custom_letter',
      requestDate: new Date('2026-01-02T00:00:00Z'),
      address: '10 Bridge Street',
      details: { purpose: 'Verification' },
      employeeComments: 'Please include the address.',
    });
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
    assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  } finally {
    console.warn = originalWarn;
  }
});

test('template data includes address aliases', () => {
  const generator = new LetterGeneratorService();
  const data = generator.buildTemplateData({
    employeeId: 'EMP-100',
    employeeName: 'Taylor Employee',
    letterType: 'visa',
    requestDate: new Date('2026-01-02T00:00:00Z'),
    address: '10 Bridge Street',
  });

  assert.equal(data.ADDRESS, '10 Bridge Street');
  assert.equal(data.Address, '10 Bridge Street');
  assert.equal(data.address, '10 Bridge Street');
});
