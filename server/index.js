const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieSession = require('cookie-session');
require('dotenv').config();
const LetterTemplate = require('./models/LetterTemplate');
const { getRuntimeConfig, validateRuntimeConfig } = require('./config/runtime');



const app = express();
const runtimeConfig = getRuntimeConfig();
const configWarnings = validateRuntimeConfig(runtimeConfig);

for (const warning of configWarnings) {
  console.warn(`Configuration warning: ${warning}`);
}

// CORS configuration: allow local frontends on 5173 and 5174 by default, or comma-separated env
const allowedOrigins = runtimeConfig.frontendOrigins;

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
    keys: [runtimeConfig.sessionSecret],
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: runtimeConfig.nodeEnv === 'production',
    sameSite: runtimeConfig.nodeEnv === 'production' ? 'strict' : 'lax',
    signed: true,
    overwrite: true, // Allow overwriting existing cookies
  })
);


// MongoDB connection
async function connectDB() {
  try {
    await mongoose.connect(runtimeConfig.mongoUri);
    console.log('✅ MongoDB connected');
    await seedDefaultTemplatesIfEmpty();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

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

app.get('/', (req, res) => {
  res.send('API is running');
});
app.get('/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'degraded',
    database: databaseReady ? 'connected' : 'disconnected',
    environment: runtimeConfig.nodeEnv,
  });
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

function startServer() {
  return app.listen(runtimeConfig.port, () => {
    console.log(`🚀 Server running on port ${runtimeConfig.port}`);
  });
}

if (require.main === module) {
  connectDB();
  startServer();
}

module.exports = { app, connectDB, startServer };
