const DEFAULT_PORT = 4000;
const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/bridge';
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';
const DEFAULT_JWT_SECRET = 'development-only-jwt-secret-change-me';
const DEFAULT_JWT_EXPIRES_IN = '8h';

function getRuntimeConfig(env = process.env) {
  const port = Number.parseInt(env.PORT || DEFAULT_PORT, 10);
  const frontendOrigins = (env.FRONTEND_ORIGIN || DEFAULT_FRONTEND_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    port: Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT,
    mongoUri: env.MONGO_URI || DEFAULT_MONGO_URI,
    frontendOrigins,
    frontendUrl: env.FRONTEND_URL || frontendOrigins[0] || DEFAULT_FRONTEND_ORIGIN,
    adminEmail: env.ADMIN_EMAIL || '',
    jwtSecret: env.JWT_SECRET || DEFAULT_JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN,
    nodeEnv: env.NODE_ENV || 'development',
  };
}

function validateRuntimeConfig(config) {
  const errors = [];

  if (!config.mongoUri) {
    errors.push('MONGO_URI is required.');
  }

  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    errors.push('JWT_SECRET must contain at least 32 characters.');
  }

  if (config.nodeEnv === 'production' && config.jwtSecret.includes('development-only')) {
    errors.push('JWT_SECRET must be set outside development.');
  }

  if (!/^\d+[smhd]$/.test(String(config.jwtExpiresIn))) {
    errors.push('JWT_EXPIRES_IN must use a duration such as 30m, 8h, or 7d.');
  }

  for (const origin of config.frontendOrigins) {
    if (!isHttpUrl(origin)) {
      errors.push(`Invalid FRONTEND_ORIGIN: ${origin}`);
    }
  }

  if (!isHttpUrl(config.frontendUrl)) {
    errors.push('FRONTEND_URL must be an absolute http(s) URL.');
  }

  if (
    config.nodeEnv === 'production'
    && config.frontendOrigins.some((origin) => isLocalhostUrl(origin))
  ) {
    errors.push('FRONTEND_ORIGIN should not point to localhost in production.');
  }

  return errors;
}

function assertRuntimeConfig(config) {
  const errors = validateRuntimeConfig(config);
  if (errors.length > 0) {
    const error = new Error(`Invalid server configuration: ${errors.join(' ')}`);
    error.code = 'INVALID_RUNTIME_CONFIG';
    throw error;
  }
  return config;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLocalhostUrl(value) {
  try {
    const { hostname } = new URL(value);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

module.exports = {
  DEFAULT_JWT_SECRET,
  assertRuntimeConfig,
  getRuntimeConfig,
  validateRuntimeConfig,
};
