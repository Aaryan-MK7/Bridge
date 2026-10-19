require('dotenv').config();
const { createApp } = require('./app');
const {
  assertRuntimeConfig,
  getRuntimeConfig,
} = require('./config/runtime');
const {
  connectDatabase,
  disconnectDatabase,
} = require('./database');

async function startServer(options = {}) {
  const config = assertRuntimeConfig(options.config || getRuntimeConfig());
  await (options.connectDatabase || connectDatabase)({ mongoUri: config.mongoUri });
  const app = (options.createApp || createApp)({ config });
  const server = await listen(app, config.port);

  const shutdown = async () => {
    await new Promise((resolve) => server.close(resolve));
    await (options.disconnectDatabase || disconnectDatabase)();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return { app, server, shutdown };
}

function listen(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once('error', reject);
  });
}

if (require.main === module) {
  startServer()
    .then(({ server }) => {
      console.log(`Bridge API listening on port ${server.address().port}`);
    })
    .catch((error) => {
      console.error('Bridge API failed to start:', error.message);
      process.exitCode = 1;
    });
}

module.exports = { listen, startServer };