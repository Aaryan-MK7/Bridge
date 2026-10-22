require('dotenv').config();
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const LetterRequest = require('../models/LetterRequest');
const { assertRuntimeConfig, getRuntimeConfig } = require('../config/runtime');
const { connectDatabase, disconnectDatabase } = require('../database');

async function seedDemoData({
  config,
  EmployeeModel = Employee,
  LetterRequestModel = LetterRequest,
}) {
  if (!config.demoMode) return;

  const passwordHash = await bcrypt.hash(config.demoPassword, 12);
  const identities = [
    {
      employeeId: config.demoUserId,
      name: 'Jordan Lee',
      title: 'Software Engineer',
      email: 'demo.employee@example.com',
      address: 'Edmonton, Alberta',
      role: 'user',
    },
    {
      employeeId: config.demoAdminId,
      name: 'Morgan Chen',
      title: 'People Operations',
      email: 'demo.admin@example.com',
      address: 'Edmonton, Alberta',
      role: 'admin',
    },
  ];

  for (const identity of identities) {
    await EmployeeModel.updateOne(
      { employeeId: identity.employeeId },
      { $set: { ...identity, passwordHash }, $setOnInsert: { authVersion: 0 } },
      { upsert: true, runValidators: true }
    );
  }

  const samples = [
    {
      employeeId: config.demoUserId,
      employeeName: 'Jordan Lee',
      letterType: 'hr_letter',
      details: {
        recipientName: 'Community Housing Office',
        recipientAddress: 'Edmonton, Alberta',
        purpose: 'Employment verification',
      },
      status: 'pending',
      employeeComments: 'Seeded demo request',
      address: 'Edmonton, Alberta',
    },
    {
      employeeId: config.demoUserId,
      employeeName: 'Jordan Lee',
      letterType: 'travel_noc',
      details: {
        purpose: 'Conference attendance',
        destination: 'Vancouver',
        travelStart: '2026-11-03',
        travelEnd: '2026-11-07',
      },
      status: 'approved',
      employeeComments: 'Seeded approved demo request',
      address: 'Edmonton, Alberta',
      processedDate: new Date(),
    },
  ];

  for (const request of samples) {
    await LetterRequestModel.updateOne(
      {
        employeeId: request.employeeId,
        employeeComments: request.employeeComments,
      },
      { $setOnInsert: request },
      { upsert: true, runValidators: true }
    );
  }
}

async function run() {
  const config = assertRuntimeConfig(getRuntimeConfig());
  await connectDatabase({ mongoUri: config.mongoUri });
  await seedDemoData({ config });
  console.log('Bridge demo data is ready.');
}

if (require.main === module) {
  run()
    .catch((error) => {
      console.error(`Unable to seed Bridge demo data: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => disconnectDatabase());
}

module.exports = { seedDemoData };
