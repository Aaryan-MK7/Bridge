const mongoose = require('mongoose');
const LetterTemplate = require('./models/LetterTemplate');

const DEFAULT_TEMPLATES = Object.freeze([
  {
    label: 'Certification Reimbursement',
    value: 'certification',
    url: 'https://docs.google.com/document/d/193TkX-J6HHpoWx8Ahdhof3EukhGkk6VV/edit',
    fields: [
      { name: 'courseName', label: 'Course or certification', type: 'text', required: true },
      { name: 'amount', label: 'Reimbursement amount', type: 'number', required: true },
      { name: 'institute', label: 'Institution', type: 'text', required: true },
    ],
  },
  {
    label: 'HR Letter',
    value: 'hr_letter',
    url: 'https://docs.google.com/document/d/1SgBMZYqTtQlbvUbk38S3YXk-b0xokwl4/edit',
    fields: [
      { name: 'recipientName', label: 'Recipient name', type: 'text', required: true },
      { name: 'recipientAddress', label: 'Recipient address', type: 'text', required: true },
      { name: 'purpose', label: 'Purpose', type: 'text', required: true },
    ],
  },
  {
    label: 'Internship Letter Completion',
    value: 'internship_completion',
    url: 'https://docs.google.com/document/d/1YuRniRa8TlCRB9-x0oWFPMMkxmUCJfOR/edit',
    fields: [
      { name: 'internshipRole', label: 'Internship role', type: 'text', required: true },
      { name: 'startDate', label: 'Start date', type: 'date', required: true },
      { name: 'endDate', label: 'End date', type: 'date', required: true },
    ],
  },
  {
    label: 'Travel NOC Letter',
    value: 'travel_noc',
    url: 'https://docs.google.com/document/d/1wc6birpYSbuxyQhDgHLD-2yaapLJEawl/edit',
    fields: [
      { name: 'purpose', label: 'Purpose of travel', type: 'text', required: true },
      { name: 'destination', label: 'Destination', type: 'text', required: true },
      { name: 'travelStart', label: 'Travel start', type: 'date', required: true },
      { name: 'travelEnd', label: 'Travel end', type: 'date', required: true },
    ],
  },
  {
    label: 'Visa Letter',
    value: 'visa',
    url: 'https://docs.google.com/document/d/1KGIPp31eyIGixIfBqk3O20nrHY47oq_N/edit',
    fields: [
      { name: 'country', label: 'Destination country', type: 'text', required: true },
      { name: 'duration', label: 'Duration of stay', type: 'text', required: true },
      { name: 'purpose', label: 'Purpose of visit', type: 'text', required: true },
    ],
  },
]);

async function connectDatabase({
  mongoUri,
  mongooseInstance = mongoose,
  LetterTemplateModel = LetterTemplate,
}) {
  await mongooseInstance.connect(mongoUri);
  await seedDefaultTemplates(LetterTemplateModel);
  return mongooseInstance.connection;
}

async function disconnectDatabase(mongooseInstance = mongoose) {
  if (mongooseInstance.connection.readyState !== 0) {
    await mongooseInstance.connection.close();
  }
}

async function seedDefaultTemplates(LetterTemplateModel = LetterTemplate) {
  const existingCount = await LetterTemplateModel.countDocuments();
  if (existingCount === 0) {
    await LetterTemplateModel.insertMany(DEFAULT_TEMPLATES);
    return;
  }

  for (const template of DEFAULT_TEMPLATES) {
    await LetterTemplateModel.updateOne(
      {
        value: template.value,
        $or: [
          { fields: { $exists: false } },
          { fields: { $size: 0 } },
        ],
      },
      { $set: { fields: template.fields } }
    );
  }
}

module.exports = {
  DEFAULT_TEMPLATES,
  connectDatabase,
  disconnectDatabase,
  seedDefaultTemplates,
};
