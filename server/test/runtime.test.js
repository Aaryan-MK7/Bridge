const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../app');
const { startServer } = require('../index');
const {
  getRuntimeConfig,
  validateRuntimeConfig,
} = require('../config/runtime');

test('uses safe development defaults', () => {
  const config = getRuntimeConfig({});

  assert.equal(config.port, 4000);
  assert.equal(config.mongoUri, 'mongodb://127.0.0.1:27017/bridge');
  assert.deepEqual(config.frontendOrigins, ['http://localhost:5173']);
});

test('normalizes comma-separated frontend origins', () => {
  const config = getRuntimeConfig({
    PORT: '4100',
    MONGO_URI: 'mongodb://db.example/bridge',
    FRONTEND_ORIGIN: 'https://portal.example, https://admin.example ',
    FRONTEND_URL: 'https://portal.example',
    JWT_SECRET: 'a-production-secret-with-at-least-32-characters',
    NODE_ENV: 'production',
  });

  assert.equal(config.port, 4100);
  assert.deepEqual(config.frontendOrigins, [
    'https://portal.example',
    'https://admin.example',
  ]);
  assert.deepEqual(validateRuntimeConfig(config), []);
});

test('reports unsafe production defaults', () => {
  const config = getRuntimeConfig({ NODE_ENV: 'production' });

  assert.deepEqual(validateRuntimeConfig(config), [
    'JWT_SECRET must be set outside development.',
    'FRONTEND_ORIGIN should not point to localhost in production.',
  ]);
});

test('serves a degraded health response before the database connects', async () => {
  const config = getRuntimeConfig({ NODE_ENV: 'test' });
  const app = createApp({
    config,
    databaseState: () => false,
    logger: { error() {} },
  });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(body, {
      status: 'degraded',
      database: 'disconnected',
      environment: 'test',
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('disconnects the database when HTTP startup fails', async () => {
  let disconnected = false;
  await assert.rejects(
    startServer({
      config: getRuntimeConfig({ NODE_ENV: 'test' }),
      connectDatabase: async () => {},
      disconnectDatabase: async () => { disconnected = true; },
      createApp: () => ({}),
      listen: async () => {
        const error = new Error('Address in use');
        error.code = 'EADDRINUSE';
        throw error;
      },
    }),
    { code: 'EADDRINUSE' }
  );
  assert.equal(disconnected, true);
});
