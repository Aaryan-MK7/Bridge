const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'date'], default: 'text' },
  },
  { _id: false }
);

const letterTemplateSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true, unique: true },
  url: { type: String, default: '' },
  fields: { type: [fieldSchema], default: [] },
  isActive: { type: Boolean, default: true },
});

module.exports = mongoose.model('LetterTemplate', letterTemplateSchema);
