const jwt = require('jsonwebtoken');

const JWT_OPTIONS = Object.freeze({
  algorithm: 'HS256',
  issuer: 'bridge-api',
  audience: 'bridge-client',
});

function createTokenService({ secret, expiresIn }) {
  return {
    sign(employee) {
      return jwt.sign(
        {
          employeeId: employee.employeeId,
        },
        secret,
        {
          ...JWT_OPTIONS,
          expiresIn,
          subject: String(employee._id),
        }
      );
    },

    verify(token) {
      return jwt.verify(token, secret, JWT_OPTIONS);
    },
  };
}

module.exports = { JWT_OPTIONS, createTokenService };
