const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  startDate: { type: Date },
  title: { type: String },
  address: { type: String },
  email: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  // Auth
  passwordHash: { type: String, default: '' },
  // Password reset
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
});

module.exports = mongoose.model('Employee', employeeSchema);
