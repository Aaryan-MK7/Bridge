const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs').promises;
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createApp } = require('../app');
const { getRuntimeConfig } = require('../config/runtime');
const { connectDatabase, disconnectDatabase } = require('../database');
const LetterGeneratorService = require('../services/letterGeneratorService');

const JWT_SECRET = 'bridge-live-smoke-jwt-secret-32-characters';

async function run() {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-live-smoke-'));
  const databaseDirectory = path.join(tempDirectory, 'mongo');
  await fs.mkdir(databaseDirectory);

  const mongoPort = await getFreePort();
  const mongoUri = `mongodb://127.0.0.1:${mongoPort}/bridge-smoke`;
  const mongod = spawn(process.env.MONGOD_BINARY || 'mongod', [
    '--bind_ip', '127.0.0.1',
    '--dbpath', databaseDirectory,
    '--port', String(mongoPort),
    '--quiet',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let mongoLogs = '';
  mongod.stdout.on('data', (chunk) => { mongoLogs += chunk; });
  mongod.stderr.on('data', (chunk) => { mongoLogs += chunk; });

  let server;
  try {
    await waitForPort(mongoPort, mongod);
    const adminPassword = crypto.randomBytes(24).toString('base64url');
    const employeePassword = crypto.randomBytes(24).toString('base64url');
    await runAdminBootstrap({ mongoUri, password: adminPassword });

    await connectDatabase({ mongoUri });
    const config = getRuntimeConfig({
      MONGO_URI: mongoUri,
      FRONTEND_ORIGIN: 'http://127.0.0.1:5173',
      FRONTEND_URL: 'http://127.0.0.1:5173',
      JWT_SECRET,
      JWT_EXPIRES_IN: '1h',
      NODE_ENV: 'test',
    });
    const app = createApp({
      config,
      services: {
        letterGenerator: new LetterGeneratorService({
          templatesPath: path.join(tempDirectory, 'missing-templates'),
          outputPath: path.join(tempDirectory, 'generated'),
        }),
      },
      logger: { error() {} },
    });
    server = await listen(app);
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    await expectStatus(baseUrl, '/api/employees', {}, 401);
    const admin = await login(baseUrl, 'ADMIN-001', adminPassword);

    await expectStatus(baseUrl, '/api/employees', {
      method: 'POST',
      token: admin.token,
      body: {
        employeeId: 'EMP-001',
        name: 'Smoke Employee',
        password: employeePassword,
      },
    }, 201);
    await expectStatus(baseUrl, '/api/employees', {
      method: 'POST',
      token: admin.token,
      body: {
        employeeId: 'EMP-002',
        name: 'Other Employee',
        password: employeePassword,
      },
    }, 201);

    const employee = await login(baseUrl, 'EMP-001', employeePassword);
    const otherEmployee = await login(baseUrl, 'EMP-002', employeePassword);
    await expectStatus(baseUrl, '/api/employees/EMP-001/profile', {
      token: employee.token,
    }, 200);
    await expectStatus(baseUrl, '/api/employees/EMP-001/profile', {
      token: otherEmployee.token,
    }, 403);

    const created = await request(baseUrl, '/api/letter-requests', {
      method: 'POST',
      token: employee.token,
      body: {
        letterType: 'visa',
        address: '10 Bridge Street',
        details: { country: 'Canada' },
        employeeComments: 'Live smoke request',
      },
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.request.address, '10 Bridge Street');
    const requestId = created.payload.request._id;
    const downloadResponse = await fetch(
      `${baseUrl}/api/letter-requests/${requestId}/download-letter`,
      { headers: { Authorization: `Bearer ${employee.token}` } }
    );
    assert.equal(downloadResponse.status, 200);
    assert.match(downloadResponse.headers.get('content-type') || '', /officedocument/);
    const downloadedDocument = Buffer.from(await downloadResponse.arrayBuffer());
    assert.equal(downloadedDocument.subarray(0, 2).toString(), 'PK');

    const ownRequests = await request(
      baseUrl,
      '/api/letter-requests/employee/EMP-001',
      { token: employee.token }
    );
    assert.equal(ownRequests.response.status, 200);
    assert.equal(ownRequests.payload[0].employeeId, 'EMP-001');
    await expectStatus(baseUrl, '/api/letter-requests/employee/EMP-001', {
      token: otherEmployee.token,
    }, 403);
    const adminRequests = await request(baseUrl, '/api/letter-requests', {
      token: admin.token,
    });
    assert.equal(adminRequests.response.status, 200);
    assert.equal(adminRequests.payload[0]._id, requestId);

    const approved = await request(baseUrl, `/api/letter-requests/${requestId}`, {
      method: 'PATCH',
      token: admin.token,
      body: { status: 'approved', adminNotes: 'Approved in smoke test' },
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.payload.request.status, 'approved');

    const withdrawable = await request(baseUrl, '/api/letter-requests', {
      method: 'POST',
      token: employee.token,
      body: { letterType: 'visa', details: { country: 'Japan' } },
    });
    const withdrawId = withdrawable.payload.request._id;
    await expectStatus(baseUrl, `/api/letter-requests/${withdrawId}/withdraw`, {
      method: 'POST',
      token: otherEmployee.token,
    }, 403);
    const withdrawn = await request(
      baseUrl,
      `/api/letter-requests/${withdrawId}/withdraw`,
      { method: 'POST', token: employee.token }
    );
    assert.equal(withdrawn.response.status, 200);
    assert.equal(withdrawn.payload.status, 'withdrawn');

    console.log('Live MongoDB smoke test passed.');
  } catch (error) {
    if (mongoLogs.trim()) console.error(mongoLogs.trim());
    throw error;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
    if (mongod.pid && mongod.exitCode === null) {
      mongod.kill('SIGTERM');
      await new Promise((resolve) => mongod.once('exit', resolve));
    }
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

async function runAdminBootstrap({ mongoUri, password }) {
  const child = spawn(process.execPath, [path.join(__dirname, 'createAdmin.js')], {
    env: {
      ...process.env,
      MONGO_URI: mongoUri,
      FRONTEND_ORIGIN: 'http://127.0.0.1:5173',
      FRONTEND_URL: 'http://127.0.0.1:5173',
      JWT_SECRET,
      NODE_ENV: 'test',
      ADMIN_EMPLOYEE_ID: 'ADMIN-001',
      ADMIN_NAME: 'Smoke Administrator',
      ADMIN_ACCOUNT_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: password,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const exitCode = await new Promise((resolve) => child.once('exit', resolve));
  assert.equal(exitCode, 0, `Administrator bootstrap failed: ${output.trim()}`);
}

async function login(baseUrl, employeeId, password) {
  const result = await request(baseUrl, '/api/employees/login', {
    method: 'POST',
    body: { employeeId, password },
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.success, true);
  assert.ok(result.payload.token);
  return result.payload;
}

async function expectStatus(baseUrl, pathname, options, expectedStatus) {
  const result = await request(baseUrl, pathname, options);
  assert.equal(
    result.response.status,
    expectedStatus,
    `${options.method || 'GET'} ${pathname}: ${JSON.stringify(result.payload)}`
  );
  return result;
}

async function request(baseUrl, pathname, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  return { payload, response };
}

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function waitForPort(port, child) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 15000;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      child.removeListener('error', onChildError);
      callback(value);
    };
    const onChildError = (error) => {
      finish(reject, new Error(`Unable to start mongod: ${error.message}`));
    };
    child.once('error', onChildError);
    const attempt = () => {
      if (settled) return;
      if (child.exitCode !== null) {
        finish(
          reject,
          new Error(`mongod exited before accepting connections (${child.exitCode})`)
        );
        return;
      }
      const socket = net.connect({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.end();
        finish(resolve);
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          finish(reject, new Error('Timed out waiting for mongod'));
        } else {
          setTimeout(attempt, 100);
        }
      });
    };
    attempt();
  });
}

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });
}

run().catch((error) => {
  console.error(`Live MongoDB smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
