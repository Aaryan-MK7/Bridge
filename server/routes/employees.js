const express = require('express');
const multer = require('multer');
const Papa = require('papaparse');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const { safeEmployeeDto } = require('../domain/employees');
const { AppError, asyncHandler } = require('../middleware/errors');
const {
  optionalString,
  requireObject,
  requiredString,
  validateEmail,
  validatePassword,
} = require('../utils/validation');

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_CSV_ROWS = 5000;
const MASKED_PASSWORD = /^\*+$/;

function createEmployeesRouter({
  Employee,
  auth,
  tokenService,
  emailService,
  config,
}) {
  const router = express.Router();
  const upload = createCsvUpload();

  router.post('/login', asyncHandler(async (req, res) => {
    requireObject(req.body);
    const employeeId = requiredString(req.body.employeeId, 'employeeId', { maxLength: 80 });
    const password = requiredString(req.body.password, 'password', { maxLength: 128 });
    const employee = await Employee.findOne({ employeeId }).select('+passwordHash');

    if (!employee?.passwordHash || !(await bcrypt.compare(password, employee.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid employee ID or password');
    }

    res.json({
      success: true,
      token: tokenService.sign(employee),
      employee: safeEmployeeDto(employee),
    });
  }));

  router.post('/forgot-password', asyncHandler(async (req, res) => {
    requireObject(req.body);
    const employeeId = requiredString(req.body.employeeId, 'employeeId', { maxLength: 80 });
    const email = validateEmail(req.body.email, 'email', { required: true });
    const employee = await Employee.findOne({ employeeId });

    if (employee && employee.email && employee.email.toLowerCase() === email) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      employee.resetToken = hashResetToken(rawToken);
      employee.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await employee.save();

      const resetUrl = new URL('/reset-password', config.frontendUrl);
      resetUrl.searchParams.set('token', rawToken);
      resetUrl.searchParams.set('employeeId', employee.employeeId);
      await emailService.sendPasswordResetEmail(employee, resetUrl.toString());
    }

    res.status(202).json({
      success: true,
      message: 'If the account details match, a password reset link will be sent.',
    });
  }));

  router.post('/reset-password', asyncHandler(async (req, res) => {
    requireObject(req.body);
    const employeeId = requiredString(req.body.employeeId, 'employeeId', { maxLength: 80 });
    const resetToken = requiredString(req.body.resetToken, 'resetToken', { maxLength: 128 });
    const newPassword = validatePassword(req.body.newPassword, 'newPassword');
    const employee = await Employee.findOne({
      employeeId,
      resetToken: hashResetToken(resetToken),
      resetTokenExpiry: { $gt: new Date() },
    }).select('+passwordHash +resetToken +resetTokenExpiry');

    if (!employee) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'The password reset link is invalid or expired');
    }

    employee.passwordHash = await bcrypt.hash(newPassword, 12);
    employee.resetToken = undefined;
    employee.resetTokenExpiry = undefined;
    await employee.save();

    res.json({ success: true, message: 'Password reset successfully' });
  }));

  router.use(auth.requireAuth);

  router.post(
    '/import',
    auth.requireAdmin,
    upload.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        throw new AppError(400, 'INVALID_UPLOAD', 'A CSV file is required');
      }

      const rows = parseEmployeeCsv(req.file.buffer.toString('utf8'));
      const operations = rows.map((employee) => ({
        updateOne: {
          filter: { employeeId: employee.employeeId },
          update: {
            $set: employee,
            $setOnInsert: { role: 'user' },
          },
          upsert: true,
        },
      }));
      const result = await Employee.bulkWrite(operations, { ordered: false });

      res.json({
        success: true,
        processed: rows.length,
        created: result.upsertedCount || 0,
        updated: result.modifiedCount || 0,
      });
    })
  );

  router.post('/', auth.requireAdmin, asyncHandler(async (req, res) => {
    requireObject(req.body);
    const employeeData = parseEmployeeInput(req.body, { allowRole: true });
    const password = optionalString(req.body.password, 'password', { maxLength: 128 });
    if (password && !MASKED_PASSWORD.test(password)) {
      validatePassword(password);
      employeeData.passwordHash = await bcrypt.hash(password, 12);
    }

    const employee = await Employee.create(employeeData);
    res.status(201).json(safeEmployeeDto(employee));
  }));

  router.get('/', auth.requireAdmin, asyncHandler(async (req, res) => {
    const employees = await Employee.find({}).sort({ name: 1 });
    res.json(employees.map(safeEmployeeDto));
  }));

  router.get(
    '/:employeeId/profile',
    auth.requireSelfOrAdmin(),
    asyncHandler(async (req, res) => {
      const employee = await findEmployeeOrThrow(Employee, req.params.employeeId);
      res.json(safeEmployeeDto(employee));
    })
  );

  router.get(
    '/:employeeId',
    auth.requireSelfOrAdmin(),
    asyncHandler(async (req, res) => {
      const employee = await findEmployeeOrThrow(Employee, req.params.employeeId);
      res.json(safeEmployeeDto(employee));
    })
  );

  router.patch(
    '/:employeeId',
    auth.requireSelfOrAdmin(),
    asyncHandler(async (req, res) => {
      requireObject(req.body);
      const isAdmin = req.employee.role === 'admin';
      const allowedFields = isAdmin
        ? ['name', 'startDate', 'title', 'address', 'email']
        : ['address', 'email'];
      const update = parseEmployeePatch(req.body, allowedFields);
      const employee = await Employee.findOneAndUpdate(
        { employeeId: req.params.employeeId },
        { $set: update },
        { new: true, runValidators: true }
      );
      if (!employee) {
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
      }
      res.json(safeEmployeeDto(employee));
    })
  );

  router.delete(
    '/:employeeId',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      if (req.params.employeeId === req.employee.employeeId) {
        throw new AppError(400, 'INVALID_OPERATION', 'Administrators cannot delete themselves');
      }
      const employee = await Employee.findOneAndDelete({ employeeId: req.params.employeeId });
      if (!employee) {
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
      }
      res.json({ success: true, message: 'Employee deleted successfully' });
    })
  );

  router.patch(
    '/:employeeId/make-admin',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const employee = await Employee.findOneAndUpdate(
        { employeeId: req.params.employeeId },
        { $set: { role: 'admin' } },
        { new: true, runValidators: true }
      );
      if (!employee) {
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
      }
      res.json({
        message: 'Employee promoted to administrator',
        employee: safeEmployeeDto(employee),
      });
    })
  );

  router.patch(
    '/:employeeId/remove-admin',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      if (req.params.employeeId === req.employee.employeeId) {
        throw new AppError(400, 'INVALID_OPERATION', 'Administrators cannot demote themselves');
      }
      const employee = await Employee.findOneAndUpdate(
        { employeeId: req.params.employeeId },
        { $set: { role: 'user' } },
        { new: true, runValidators: true }
      );
      if (!employee) {
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
      }
      res.json({
        message: 'Administrator role removed',
        employee: safeEmployeeDto(employee),
      });
    })
  );

  router.post(
    '/:employeeId/change-password',
    auth.requireSelfOrAdmin(),
    asyncHandler(async (req, res) => {
      requireObject(req.body);
      const oldPassword = requiredString(req.body.oldPassword, 'oldPassword', { maxLength: 128 });
      const newPassword = validatePassword(req.body.newPassword, 'newPassword');
      const employee = await Employee.findOne({
        employeeId: req.params.employeeId,
      }).select('+passwordHash');

      if (!employee) {
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
      }
      if (!employee.passwordHash || !(await bcrypt.compare(oldPassword, employee.passwordHash))) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'The current password is incorrect');
      }

      employee.passwordHash = await bcrypt.hash(newPassword, 12);
      employee.resetToken = undefined;
      employee.resetTokenExpiry = undefined;
      await employee.save();
      res.json({ success: true, message: 'Password updated successfully' });
    })
  );

  return router;
}

function createCsvUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_CSV_BYTES, files: 1 },
    fileFilter(req, file, callback) {
      const extension = path.extname(file.originalname || '').toLowerCase();
      const allowedMimeTypes = new Set([
        'text/csv',
        'application/csv',
        'application/vnd.ms-excel',
      ]);
      if (extension !== '.csv' || !allowedMimeTypes.has(file.mimetype)) {
        return callback(new AppError(400, 'INVALID_UPLOAD', 'Only CSV files are accepted'));
      }
      return callback(null, true);
    },
  });
}

function parseEmployeeCsv(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });
  if (parsed.errors.length > 0) {
    throw new AppError(400, 'INVALID_CSV', 'The CSV file could not be parsed', parsed.errors);
  }
  if (parsed.data.length === 0) {
    throw new AppError(400, 'INVALID_CSV', 'The CSV file is empty');
  }
  if (parsed.data.length > MAX_CSV_ROWS) {
    throw new AppError(400, 'INVALID_CSV', `The CSV file may contain at most ${MAX_CSV_ROWS} rows`);
  }

  const seen = new Set();
  return parsed.data.map((row, index) => {
    const mapped = {
      employeeId: row['Employee ID'] ?? row.employeeId ?? row.id,
      name: row.Employee ?? row.name,
      startDate: normalizeCsvDate(row['Start date'] ?? row.startDate),
      title: row.Title ?? row.title ?? '',
      address: row['Home address - Full address'] ?? row.address ?? '',
      email: row.Email ?? row.email ?? '',
    };

    try {
      const employee = parseEmployeeInput(mapped);
      if (seen.has(employee.employeeId)) {
        throw new AppError(400, 'INVALID_CSV', `Duplicate employeeId ${employee.employeeId}`);
      }
      seen.add(employee.employeeId);
      return employee;
    } catch (error) {
      if (error instanceof AppError) {
        error.message = `CSV row ${index + 2}: ${error.message}`;
      }
      throw error;
    }
  });
}

function parseEmployeeInput(input, { allowRole = false } = {}) {
  const data = {
    employeeId: requiredString(input.employeeId, 'employeeId', { maxLength: 80 }),
    name: requiredString(input.name, 'name', { maxLength: 160 }),
    title: optionalString(input.title, 'title', { maxLength: 160 }) || '',
    address: optionalString(input.address, 'address', { maxLength: 1000 }) || '',
    email: validateEmail(input.email, 'email') || '',
  };
  if (input.startDate) data.startDate = parseDate(input.startDate, 'startDate');
  if (allowRole) data.role = input.role === 'admin' ? 'admin' : 'user';
  return data;
}

function parseEmployeePatch(input, allowedFields) {
  const update = {};
  for (const field of allowedFields) {
    if (input[field] === undefined) continue;
    if (field === 'email') {
      update.email = validateEmail(input.email, 'email') || '';
    } else if (field === 'startDate') {
      update.startDate = input.startDate ? parseDate(input.startDate, 'startDate') : null;
    } else if (field === 'name') {
      update.name = requiredString(input.name, 'name', { maxLength: 160 });
    } else {
      const maxLength = field === 'address' ? 1000 : 160;
      update[field] = optionalString(input[field], field, { maxLength }) || '';
    }
  }
  if (Object.keys(update).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No editable fields were provided');
  }
  return update;
}

function parseDate(value, field) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a valid date`);
  }
  return date;
}

function normalizeCsvDate(value) {
  if (!value) return undefined;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(value).trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function findEmployeeOrThrow(Employee, employeeId) {
  const employee = await Employee.findOne({ employeeId });
  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  }
  return employee;
}

module.exports = {
  MAX_CSV_BYTES,
  createEmployeesRouter,
  hashResetToken,
  parseEmployeeCsv,
};
