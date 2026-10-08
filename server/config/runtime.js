const DEFAULT_PORT = 4000;
const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/bridge';

function getRuntimeConfig(env = process.env) {
  const port = Number.parseInt(env.PORT || DEFAULT_PORT, 10);

  return {
    port: Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT,
    mongoUri: env.MONGO_URI || DEFAULT_MONGO_URI,
    sessionSecret: env.SESSION_SECRET || 'development-only-session-secret',
    frontendOrigins: (env.FRONTEND_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    nodeEnv: env.NODE_ENV || 'development',
  };
}

function validateRuntimeConfig(config) {
  const warnings = [];

  if (config.nodeEnv === 'production' && config.sessionSecret.includes('development-only')) {
    warnings.push('SESSION_SECRET must be set outside development.');
  }

  if (config.nodeEnv === 'production' && config.frontendOrigins.some((origin) => origin.includes('localhost'))) {
    warnings.push('FRONTEND_ORIGIN should not point to localhost in production.');
  }

  return warnings;
}

module.exports = { getRuntimeConfig, validateRuntimeConfig };
