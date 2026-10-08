const mongoose = require('mongoose');

const letterRequestSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true
  },
  employeeName: {
    type: String,
    required: true
  },
  letterType: {
    type: String,
    required: true
  },
  // Dynamic per-letter-type inputs
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'withdrawn', 'letter_generated', 'sent_for_signing', 'signed', 'completed'],
    default: 'pending'
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  adminNotes: {
    type: String,
    default: ''
  },
  employeeComments: {
    type: String,
    default: ''
  },
  processedDate: {
    type: Date
  },
  // Generated Letter Fields
  generatedLetterPath: {
    type: String,
    default: null
  },
  generatedLetterFilename: {
    type: String,
    default: null
  },
  letterGeneratedDate: {
    type: Date,
    default: null
  },
  // DocuSign Integration Fields
  docusignEnvelopeId: {
    type: String,
    default: null
  },
  docusignEnvelopeStatus: {
    type: String,
    default: null
  },
  docusignSigningUrl: {
    type: String,
    default: null
  },
  docusignTemplateId: {
    type: String,
    default: null
  },
  docusignSentDate: {
    type: Date,
    default: null
  },
  docusignCompletedDate: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('LetterRequest', letterRequestSchema);
