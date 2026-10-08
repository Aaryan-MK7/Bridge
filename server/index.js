const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieSession = require('cookie-session');
require('dotenv').config();
const LetterTemplate = require('./models/LetterTemplate');



const app = express();

// CORS configuration: allow local frontends on 5173 and 5174 by default, or comma-separated env
const allowedOrigins = (process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',')
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ]
).map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow non-browser clients
      if (allowedOrigins.includes(origin)) return callback(null, true);
      try {
        const parsed = new URL(origin);
        const isLocalhost =
          parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        const isAllowedPort = parsed.port === '5173' || parsed.port === '5174';
        if (isLocalhost && isAllowedPort) return callback(null, true);
      } catch (_) {}
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true, // Allow cookies to be sent
    optionsSuccessStatus: 200,
  })
);

// Parse JSON request bodies
app.use(express.json());

// Cookie session for DocuSign OAuth
app.use(
  cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'dev-secret'],
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: false, // Allow JavaScript access for debugging
    secure: false, // Set to false for localhost (HTTP)
    sameSite: 'lax', // Allow cross-origin cookies
    signed: false, // Disable signing for debugging
    overwrite: true, // Allow overwriting existing cookies
  })
);

// Debug middleware to log session info
app.use((req, res, next) => {
  console.log('🔍 Middleware - Session ID:', req.session.id);
  console.log('🔍 Middleware - Session data:', JSON.stringify(req.session, null, 2));
  console.log('🔍 Middleware - Cookies:', req.headers.cookie);
  next();
});



// MongoDB connection
async function connectDB() {
  try {
    const mongoUri =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hr_letters';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');
    await seedDefaultTemplatesIfEmpty();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}
connectDB();

async function seedDefaultTemplatesIfEmpty() {
  try {
    const existingCount = await LetterTemplate.countDocuments();
    if (existingCount > 0) return;

    const defaultTemplates = [
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
    ];

    await LetterTemplate.insertMany(defaultTemplates);
    console.log('✅ Seeded default letter templates');
  } catch (seedErr) {
    console.error('❌ Failed to seed default templates:', seedErr);
  }
}

// Health check route
app.get('/', (req, res) => {
  res.send('API is running');
});

// Test session route
app.get('/test-session', (req, res) => {
  req.session.testValue = 'test-' + Date.now();
  res.json({
    message: 'Session test value set',
    sessionId: req.session.id,
    testValue: req.session.testValue,
    sessionData: req.session
  });
});

// Routes
const employeeRoutes = require('./routes/employees');
const letterRequestRoutes = require('./routes/letterRequests');
const templateRoutes = require('./routes/templates');
const pdfFillerRoutes = require('./routes/pdfFiller');
const settingsRoutes = require('./routes/settings');
const docusignRoutes = require('./routes/docusign');


app.use('/api/employees', employeeRoutes);
app.use('/api/letter-requests', letterRequestRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/pdf-filler', pdfFillerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/docusign', docusignRoutes);




// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down...');
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (closeErr) {
    console.error('Error closing MongoDB connection:', closeErr);
  }
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
