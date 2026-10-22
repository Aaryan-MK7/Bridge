const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const Employee = require('./models/Employee');
const LetterRequest = require('./models/LetterRequest');
const LetterTemplate = require('./models/LetterTemplate');
const Setting = require('./models/Setting');
const { getRuntimeConfig } = require('./config/runtime');
const { createAuthMiddleware } = require('./middleware/auth');
const {
  AppError,
  errorHandler,
  notFoundHandler,
} = require('./middleware/errors');
const { createTokenService } = require('./services/tokenService');
const EmailService = require('./services/emailService');
const LetterGeneratorService = require('./services/letterGeneratorService');
const DocuSignService = require('./services/docusignService');
const { DocuSignRegistry } = require('./services/docusignRegistry');
const { createEmployeesRouter } = require('./routes/employees');
const { createLetterRequestsRouter } = require('./routes/letterRequests');
const { createTemplatesRouter } = require('./routes/templates');
const { createSettingsRouter } = require('./routes/settings');
const { createDocuSignRouter } = require('./routes/docusign');

function createApp(options = {}) {
  const config = options.config || getRuntimeConfig();
  const models = {
    Employee,
    LetterRequest,
    LetterTemplate,
    Setting,
    ...options.models,
  };
  const tokenService = options.services?.tokenService || createTokenService({
    secret: config.jwtSecret,
    expiresIn: config.jwtExpiresIn,
  });
  const emailService = options.services?.emailService || new EmailService();
  const letterGenerator = options.services?.letterGenerator || new LetterGeneratorService();
  const docusignRegistry = options.services?.docusignRegistry || new DocuSignRegistry({
    serviceFactory: () => new DocuSignService(),
  });
  const auth = createAuthMiddleware({ Employee: models.Employee, tokenService });
  const logger = options.logger || console;
  const databaseState = options.databaseState
    || (() => mongoose.connection.readyState === 1);

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(createCorsOptions(config.frontendOrigins)));
  app.use(express.json({ limit: '10mb' }));

  if (config.nodeEnv !== 'production') {
    app.get('/', (req, res) => res.send('API is running'));
  }
  app.get('/health', (req, res) => {
    const databaseReady = Boolean(databaseState());
    res.status(databaseReady ? 200 : 503).json({
      status: databaseReady ? 'ok' : 'degraded',
      database: databaseReady ? 'connected' : 'disconnected',
      environment: config.nodeEnv,
    });
  });

  app.use('/api/employees', createEmployeesRouter({
    Employee: models.Employee,
    auth,
    tokenService,
    emailService,
    config,
  }));
  app.use('/api/letter-requests', createLetterRequestsRouter({
    LetterRequest: models.LetterRequest,
    Employee: models.Employee,
    LetterTemplate: models.LetterTemplate,
    auth,
    letterGenerator,
    emailService,
    docusignRegistry,
    Setting: models.Setting,
    config,
  }));
  app.use('/api/templates', createTemplatesRouter({
    LetterTemplate: models.LetterTemplate,
    auth,
  }));
  app.use('/api/settings', createSettingsRouter({
    Setting: models.Setting,
    auth,
    emailService,
  }));
  app.use('/api/docusign', createDocuSignRouter({
    auth,
    docusignRegistry,
    config,
  }));

  const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
  if (config.nodeEnv === 'production' && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('/{*splat}', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      return res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}

function createCorsOptions(allowedOrigins) {
  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new AppError(403, 'CORS_NOT_ALLOWED', 'Origin is not allowed'));
    },
    credentials: false,
    optionsSuccessStatus: 204,
  };
}

module.exports = { createApp, createCorsOptions };
