const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  startDate: { type: Date },
  title: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true, lowercase: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  passwordHash: { type: String, default: '', select: false },
  resetToken: { type: String, select: false },
  resetTokenExpiry: { type: Date, select: false },
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.passwordHash;
      delete ret.resetToken;
      delete ret.resetTokenExpiry;
      return ret;
    },
  },
  toObject: {
    transform(doc, ret) {
      delete ret.passwordHash;
      delete ret.resetToken;
      delete ret.resetTokenExpiry;
      return ret;
    },
  },
});

module.exports = mongoose.model('Employee', employeeSchema);
