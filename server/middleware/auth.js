// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication token missing or invalid' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const employee = await Employee.findOne({
      _id: decoded.id,
      'tokens.token': token
    });

    if (!employee) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    req.token = token;
    req.employee = employee;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(403).json({ error: 'Admin authentication token missing or invalid' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const employee = await Employee.findOne({
      _id: decoded.id,
      'tokens.token': token,
      role: 'admin'
    });

    if (!employee) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.token = token;
    req.employee = employee;
    next();
  } catch (e) {
    res.status(403).json({ error: 'Admin access required' });
  }
};

module.exports = {
  requireAuth: auth,
  requireAdmin: adminAuth
};
