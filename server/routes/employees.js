const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const Employee = require('../models/Employee');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const CSV_PATH = path.join(__dirname, '..', 'employees.csv');

function formatDateDDMMYYYY(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    // Try parsing from DD-MM-YYYY
    const parts = String(dateInput).split('-');
    if (parts.length === 3 && parts[0].length === 2) return String(dateInput);
    return '';
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function upsertEmployeeInCsv(employeeDoc) {
  try {
    let csvText = '';
    try {
      csvText = fs.readFileSync(CSV_PATH, 'utf8');
    } catch (readErr) {
      if (readErr.code !== 'ENOENT') throw readErr;
      // If file doesn't exist, we'll create it below
    }

    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const existingRows = Array.isArray(parsed.data) ? parsed.data : [];

    let headers = (parsed.meta?.fields && parsed.meta.fields.length > 0)
      ? parsed.meta.fields
      : [
          'Employee ID',
          'Employee',
          'Start date',
          'Title',
          'Home address - Full address',
          'Email',
        ];
    // Ensure Email column exists even for legacy CSVs without it
    if (!headers.includes('Email')) headers = [...headers, 'Email'];

    const updatedRow = {
      'Employee ID': employeeDoc.employeeId || '',
      'Employee': employeeDoc.name || '',
      'Start date': formatDateDDMMYYYY(employeeDoc.startDate),
      'Title': employeeDoc.title || '',
      'Home address - Full address': employeeDoc.address || '',
      'Email': employeeDoc.email || '',
    };

    const normalizedId = String(employeeDoc.employeeId || '').trim();

    // Filter out fully empty rows and upsert the target employee
    const filteredRows = existingRows.filter((row) => {
      const hasAnyValue = headers.some((h) => (row?.[h] || '').toString().trim() !== '');
      return hasAnyValue;
    });

    let replaced = false;
    const newRows = filteredRows.map((row) => {
      if (String(row['Employee ID'] || '').trim() === normalizedId) {
        replaced = true;
        return updatedRow;
      }
      return row;
    });
    if (!replaced) newRows.push(updatedRow);

    // Ensure output respects header order
    const dataMatrix = newRows.map((row) => headers.map((h) => (row?.[h] ?? '')));
    const csvOut = Papa.unparse({ fields: headers, data: dataMatrix });
    fs.writeFileSync(CSV_PATH, csvOut, 'utf8');
  } catch (e) {
    console.error('❌ Failed to update employees.csv:', e.message);
  }
}

function parseDDMMYYYYtoISO(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return '';
  const [dd, mm, yyyy] = parts;
  const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : iso;
}

function getEmployeeFromCsv(employeeId) {
  try {
    const csvText = fs.readFileSync(CSV_PATH, 'utf8');
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: false });
    const rows = parsed.data || [];
    const row = rows.find(r => String(r['Employee ID']).trim() === String(employeeId).trim());
    if (!row) return null;
    return {
      employeeId: row['Employee ID'] || '',
      name: row['Employee'] || '',
      startDate: parseDDMMYYYYtoISO(row['Start date'] || ''),
      title: row['Title'] || '',
      address: row['Home address - Full address'] || '',
      email: row['Email'] || '',
    };
  } catch (e) {
    console.error('❌ Failed reading employees.csv:', e.message);
    return null;
  }
}

function loadAllEmployeesFromCsv() {
  try {
    const csvText = fs.readFileSync(CSV_PATH, 'utf8');
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = parsed.data || [];
    const list = [];
    for (const row of rows) {
      const id = (row['Employee ID'] || '').toString().trim();
      if (!id) continue;
      list.push({
        employeeId: id,
        name: row['Employee'] || '',
        // Keep CSV display string; API consumers can parse if needed
        startDateCsv: (row['Start date'] || '').toString().trim(),
        title: row['Title'] || '',
        address: row['Home address - Full address'] || '',
      });
    }
    return list;
  } catch (e) {
    return [];
  }
}

// Profile details with CSV precedence
router.get('/:employeeId/profile', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const dbEmp = await Employee.findOne({ employeeId });
    const csvEmp = getEmployeeFromCsv(employeeId);
    if (!dbEmp && !csvEmp) return res.status(404).json({ error: 'Employee not found' });
    const merged = {
      employeeId: dbEmp?.employeeId || csvEmp?.employeeId || employeeId,
      name: csvEmp?.name || dbEmp?.name || '',
      startDate: csvEmp?.startDate || (dbEmp?.startDate ? new Date(dbEmp.startDate).toISOString().slice(0,10) : ''),
      title: csvEmp?.title || dbEmp?.title || '',
      address: csvEmp?.address || dbEmp?.address || '',
      email: dbEmp?.email || csvEmp?.email || '',
      role: dbEmp?.role || 'user',
    };
    res.json(merged);
  } catch (err) {
    console.error('❌ Profile fetch error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const SUPER_ADMIN_NAME = 'Aarav Mehta';
function isSuperAdmin(employee) {
  if (!employee) return false;
  return (employee.name || '').toLowerCase() === SUPER_ADMIN_NAME.toLowerCase();
}

// Create a new employee
router.post('/', async (req, res) => {
  try {
    console.log("👉 Incoming POST body:", req.body);

    const { employeeId, name, startDate, title, address, role, password, email } = req.body;

    if (!employeeId || !name) {
      return res.status(400).json({ error: "Missing required fields: employeeId and name are required." });
    }

    const existingEmployee = await Employee.findOne({ employeeId });
    if (existingEmployee) {
      return res.status(409).json({ error: "Employee with this employeeId already exists." });
    }

    const normalizedRole = role === 'admin' ? 'admin' : 'user';
    const newEmployee = new Employee({
      employeeId,
      name,
      startDate,
      title,
      address,
      role: normalizedRole,
      email: email || ''
    });
    // default password or provided password; default to '123'
    const plain = (password && String(password)) || '123';
    const salt = await bcrypt.genSalt(10);
    newEmployee.passwordHash = await bcrypt.hash(plain, salt);

    await newEmployee.save();
    await upsertEmployeeInCsv(newEmployee);

    console.log("✅ New employee saved:", newEmployee);
    res.status(201).json(newEmployee);
  } catch (err) {
    if (err && err.code === 11000) {
      // Duplicate key (unique employeeId)
      return res.status(409).json({ error: "Employee with this employeeId already exists." });
    }
    console.error("❌ Backend error (POST /):", err);
    res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
});

// Get all employees
router.get('/', async (req, res) => {
  try {
    const [dbEmployees, csvEmployees] = await Promise.all([
      Employee.find().lean(),
      Promise.resolve(loadAllEmployeesFromCsv())
    ]);

    const idToDb = new Map(dbEmployees.map(e => [String(e.employeeId).trim(), e]));
    const idToCsv = new Map(csvEmployees.map(r => [String(r.employeeId).trim(), r]));

    const allIds = new Set([...idToDb.keys(), ...idToCsv.keys()]);
    const merged = [];

    for (const id of allIds) {
      const db = idToDb.get(id) || {};
      const csv = idToCsv.get(id) || {};

      const startDateFromDb = db.startDate ? formatDateDDMMYYYY(db.startDate) : '';
      const startDateFromCsv = csv.startDateCsv || '';

      merged.push({
        employeeId: id,
        name: (csv.name || db.name || '').toString(),
        startDate: (startDateFromCsv || startDateFromDb),
        title: (csv.title || db.title || '').toString(),
        address: (csv.address || db.address || '').toString(),
        email: (db.email || csv.email || '').toString(),
        role: db.role || 'user',
      });
    }

    merged.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(merged);
  } catch (err) {
    console.error("❌ Backend error (GET /):", err);
    res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
});

// Get a single employee by employeeId
router.get('/:employeeId', async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeId: req.params.employeeId });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json(employee);
  } catch (err) {
    console.error(`❌ Backend error (GET /${req.params.employeeId}):`, err);
    res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
});

// Update an employee by employeeId
router.patch('/:employeeId', async (req, res) => {
  try {
    const updateData = req.body;

    // Prevent changing immutable fields via this route if present
    delete updateData.employeeId;
    delete updateData.title; // title is not editable from employee portal per requirements
    delete updateData.passwordHash; // cannot set directly

    const updatedEmployee = await Employee.findOneAndUpdate(
      { employeeId: req.params.employeeId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    console.log(`✅ Employee updated (employeeId: ${req.params.employeeId}):`, updatedEmployee);
    res.json(updatedEmployee);
    try { await upsertEmployeeInCsv(updatedEmployee); } catch {}
  } catch (err) {
    console.error(`❌ Backend error (PATCH /${req.params.employeeId}):`, err);
    res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
});

// Delete an employee by employeeId
router.delete('/:employeeId', async (req, res) => {
  try {
    const deletedEmployee = await Employee.findOneAndDelete({ employeeId: req.params.employeeId });

    if (!deletedEmployee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    console.log(`✅ Employee deleted (employeeId: ${req.params.employeeId})`);
    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    console.error(`❌ Backend error (DELETE /${req.params.employeeId}):`, err);
    res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
});

// Login route - POST /api/employees/login
router.post('/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
      return res.status(400).json({ success: false, message: "Employee ID and password are required." });
    }

    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // Bootstrap default password if missing
    if (!employee.passwordHash) {
      const salt = await bcrypt.genSalt(10);
      employee.passwordHash = await bcrypt.hash('123', salt);
      await employee.save();
    }

    const ok = await bcrypt.compare(String(password), employee.passwordHash || '');
    if (!ok) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // Success — send back role info
    res.json({
      success: true,
      employee: {
        employeeId: employee.employeeId,
        name: employee.name,
        role: employee.role
      }
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});


// Admin route to promote another employee — only Super Admin can promote
router.patch('/:employeeId/make-admin', async (req, res) => {
  try {
    const requesterId = String(req.body.requesterId || '').trim();
    const targetId = String(req.params.employeeId || '').trim();

    const requester = await Employee.findOne({ employeeId: requesterId });
    if (!requester || !isSuperAdmin(requester)) {
      return res.status(403).json({ error: "Only the Super Admin can promote admins." });
    }

    const updatedEmployee = await Employee.findOneAndUpdate(
      { employeeId: targetId },
      { role: "admin" },
      { new: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ message: "Employee promoted to admin successfully", employee: updatedEmployee });
  } catch (err) {
    console.error(`❌ Backend error (make-admin):`, err);
    res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
});

// Demote admin back to user — only Super Admin can demote
router.patch('/:employeeId/remove-admin', async (req, res) => {
  try {
    const requesterId = String(req.body.requesterId || '').trim();
    const targetId = String(req.params.employeeId || '').trim();
    const requester = await Employee.findOne({ employeeId: requesterId });
    if (!requester || !isSuperAdmin(requester)) {
      return res.status(403).json({ error: "Only the Super Admin can remove admins." });
    }

    const target = await Employee.findOne({ employeeId: targetId });
    if (!target) {
      return res.status(404).json({ error: "Employee not found" });
    }

    if (isSuperAdmin(target)) {
      return res.status(400).json({ error: "Cannot demote the Super Admin" });
    }

    if (target.role !== 'admin') {
      return res.json({ message: "Employee is already not an admin", employee: target });
    }

    const updated = await Employee.findOneAndUpdate(
      { employeeId: targetId },
      { role: 'user' },
      { new: true, runValidators: false }
    );
    res.json({ message: "Employee demoted to user successfully", employee: updated });
  } catch (err) {
    console.error(`❌ Backend error (remove-admin):`, err);
    res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
});

// Change password
router.post('/:employeeId/change-password', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Old and new passwords are required' });
    }

    const employee = await Employee.findOne({ employeeId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const ok = await bcrypt.compare(String(oldPassword), employee.passwordHash || '');
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid current password' });

    const salt = await bcrypt.genSalt(10);
    employee.passwordHash = await bcrypt.hash(String(newPassword), salt);
    await employee.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('❌ Change password error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Forgot password - send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { employeeId, email } = req.body;

    if (!employeeId || !email) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID and email are required'
      });
    }

    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Verify email matches the employee (with better error handling)
    const storedEmail = employee.email ? employee.email.trim() : '';
    const inputEmail = email ? email.trim() : '';

    if (!storedEmail) {
      return res.status(400).json({
        success: false,
        message: 'No email found for this employee. Please contact HR to update your email address.'
      });
    }

    if (storedEmail !== inputEmail) {
      return res.status(400).json({
        success: false,
        message: `Email does not match. Expected: ${storedEmail}, Received: ${inputEmail}`
      });
    }

    // Generate a temporary reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in employee document
    employee.resetToken = resetToken;
    employee.resetTokenExpiry = resetTokenExpiry;
    await employee.save();

    // Create reset link
    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}&employeeId=${employeeId}`;

    // Send email with reset link
    const emailContent = `
      <h2>Password Reset Request</h2>
      <p>Hello ${employee.name},</p>
      <p>You have requested to reset your password for the HR Letter Portal.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetLink}" style="background-color: #9546F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this password reset, please ignore this email.</p>
      <p>Best regards,<br>HR Team</p>
    `;

    // Use your existing email functionality or implement a simple one
    // For now, we'll just return the reset link in the response
    // In production, you should send this via email

    res.json({
      success: true,
      message: 'Password reset link sent to your email',
      resetLink: resetLink, // Remove this in production
      note: 'In production, this link would be sent via email'
    });

  } catch (err) {
    console.error('❌ Forgot password error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { employeeId, resetToken, newPassword } = req.body;

    if (!employeeId || !resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, reset token, and new password are required'
      });
    }

    const employee = await Employee.findOne({
      employeeId,
      resetToken,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password and clear reset token
    const salt = await bcrypt.genSalt(10);
    employee.passwordHash = await bcrypt.hash(String(newPassword), salt);
    employee.resetToken = undefined;
    employee.resetTokenExpiry = undefined;
    await employee.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (err) {
    console.error('❌ Reset password error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

// Debug endpoint to check employee data
router.get('/debug/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await Employee.findOne({ employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      employee: {
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        emailLength: employee.email ? employee.email.length : 0,
        emailTrimmed: employee.email ? employee.email.trim() : null,
        emailTrimmedLength: employee.email ? employee.email.trim().length : 0
      }
    });

  } catch (err) {
    console.error('❌ Debug endpoint error:', err);
    res.status(500).json({
      success: false,
      message: 'Debug failed'
    });
  }
});

// Bulk update email addresses
router.post('/bulk-update-emails', async (req, res) => {
  try {
    const { adminPassword } = req.body;

    // Simple admin check - you might want to implement proper admin authentication
    if (adminPassword !== 'admin123') {
      return res.status(401).json({
        success: false,
        message: 'Admin password required'
      });
    }

    // Update all employees to have the default email
    const updateResult = await Employee.updateMany(
      {
        employeeId: { $ne: 'ABC0013' } // Exclude Aarav Mehta
      },
      {
        $set: { email: 'ram.bhupesh@symphonytalent.com' }
      }
    );

    // Update Aarav Mehta specifically
    await Employee.updateOne(
      { employeeId: 'ABC0013' },
      { $set: { email: 'rambhupesh05@gmail.com' } }
    );

    res.json({
      success: true,
      message: 'Email addresses updated successfully',
      updatedCount: updateResult.modifiedCount + 1
    });

  } catch (err) {
    console.error('❌ Bulk email update error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update email addresses'
    });
  }
});

module.exports = router;
// CSV Import
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const csvText = req.file.buffer.toString('utf8');
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = Array.isArray(parsed.data) ? parsed.data : [];
    if (rows.length === 0) return res.status(400).json({ error: 'CSV is empty' });

    // Normalize headers
    const h = (name) => name?.toString().trim().toLowerCase();
    const mapRow = (row) => ({
      employeeId: (row['Employee ID'] || row['employeeId'] || row['id'] || '').toString().trim(),
      name: (row['Employee'] || row['name'] || '').toString().trim(),
      startDate: parseDDMMYYYYtoISO(row['Start date'] || row['startDate'] || ''),
      title: (row['Title'] || row['title'] || '').toString().trim(),
      address: (row['Home address - Full address'] || row['address'] || '').toString().trim(),
      email: (row['Email'] || row['email'] || '').toString().trim(),
    });

    const toUpsert = rows.map(mapRow).filter(r => r.employeeId && r.name);
    const results = { upserted: 0 };
    for (const r of toUpsert) {
      const update = {
        name: r.name,
        title: r.title,
        address: r.address,
        email: r.email,
      };
      if (r.startDate) update.startDate = r.startDate;
      const doc = await Employee.findOneAndUpdate(
        { employeeId: r.employeeId },
        { $set: update, $setOnInsert: { employeeId: r.employeeId } },
        { upsert: true, new: true }
      );
      await upsertEmployeeInCsv(doc);
      results.upserted++;
    }

    res.json({ success: true, ...results });
  } catch (e) {
    console.error('CSV import failed:', e);
    res.status(500).json({ error: 'Import failed' });
  }
});
