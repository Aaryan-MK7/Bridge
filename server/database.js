const mongoose = require('mongoose');
const LetterTemplate = require('./models/LetterTemplate');

const DEFAULT_TEMPLATES = Object.freeze([
  {
    label: 'Certification Reimbursement',
    value: 'certification',
    url: 'https://docs.google.com/document/d/193TkX-J6HHpoWx8Ahdhof3EukhGkk6VV/edit',
    fields: [],
  },
  {
    label: 'HR Letter',
    value: 'hr_letter',
    url: 'https://docs.google.com/document/d/1SgBMZYqTtQlbvUbk38S3YXk-b0xokwl4/edit',
    fields: [],
  },
  {
    label: 'Internship Letter Completion',
    value: 'internship_completion',
    url: 'https://docs.google.com/document/d/1YuRniRa8TlCRB9-x0oWFPMMkxmUCJfOR/edit',
    fields: [],
  },
  {
    label: 'Travel NOC Letter',
    value: 'travel_noc',
    url: 'https://docs.google.com/document/d/1wc6birpYSbuxyQhDgHLD-2yaapLJEawl/edit',
    fields: [],
  },
  {
    label: 'Visa Letter',
    value: 'visa',
    url: 'https://docs.google.com/document/d/1KGIPp31eyIGixIfBqk3O20nrHY47oq_N/edit',
    fields: [],
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
  }
}

module.exports = {
  DEFAULT_TEMPLATES,
  connectDatabase,
  disconnectDatabase,
  seedDefaultTemplates,
};
