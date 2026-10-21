require('dotenv').config();
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const {
  assertRuntimeConfig,
  getRuntimeConfig,
} = require('../config/runtime');
const {
  connectDatabase,
  disconnectDatabase,
} = require('../database');
const {
  requiredString,
  validateEmail,
  validatePassword,
} = require('../utils/validation');

async function createAdmin() {
  const config = assertRuntimeConfig(getRuntimeConfig());
  const employeeId = requiredString(
    process.env.ADMIN_EMPLOYEE_ID,
    'ADMIN_EMPLOYEE_ID',
    { maxLength: 80 }
  );
  const name = requiredString(process.env.ADMIN_NAME, 'ADMIN_NAME', { maxLength: 160 });
  const password = validatePassword(process.env.ADMIN_PASSWORD, 'ADMIN_PASSWORD');
  const email = validateEmail(process.env.ADMIN_ACCOUNT_EMAIL, 'ADMIN_ACCOUNT_EMAIL') || '';

  await connectDatabase({ mongoUri: config.mongoUri });
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await Employee.findOne({ employeeId }).select('+passwordHash');
  if (existing) {
    existing.name = name;
    existing.email = email;
    existing.passwordHash = passwordHash;
    existing.role = 'admin';
    existing.authVersion = (existing.authVersion || 0) + 1;
    await existing.save();
  } else {
    await Employee.create({
      employeeId,
      name,
      email,
      passwordHash,
      role: 'admin',
    });
  }
  console.log(`Administrator ${employeeId} is ready.`);
}

createAdmin()
  .catch((error) => {
    console.error(`Unable to create administrator: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
