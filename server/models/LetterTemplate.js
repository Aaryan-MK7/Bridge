const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'date', 'email'], default: 'text' },
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

const letterTemplateSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  value: { type: String, required: true, unique: true, trim: true },
  url: { type: String, default: '', trim: true },
  fields: { type: [fieldSchema], default: [] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('LetterTemplate', letterTemplateSchema);
