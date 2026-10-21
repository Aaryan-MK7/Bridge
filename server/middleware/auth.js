const { AppError, asyncHandler } = require('./errors');

function createAuthMiddleware({ Employee, tokenService }) {
  const requireAuth = asyncHandler(async (req, res, next) => {
    const header = req.get('Authorization') || '';
    const match = /^Bearer ([^\s]+)$/.exec(header);
    if (!match) {
      throw new AppError(401, 'AUTH_REQUIRED', 'A valid bearer token is required');
    }

    let claims;
    try {
      claims = tokenService.verify(match[1]);
    } catch {
      throw new AppError(401, 'INVALID_TOKEN', 'The authentication token is invalid or expired');
    }

    const employee = await Employee.findById(claims.sub);
    if (!employee) {
      throw new AppError(401, 'INVALID_TOKEN', 'The authentication token is no longer valid');
    }
    if (Number(claims.authVersion || 0) !== Number(employee.authVersion || 0)) {
      throw new AppError(401, 'INVALID_TOKEN', 'The authentication token is no longer valid');
    }

    req.auth = { claims, token: match[1] };
    req.employee = employee;
    next();
  });

  function requireAdmin(req, res, next) {
    if (!req.employee || req.employee.role !== 'admin') {
      return next(new AppError(403, 'ADMIN_REQUIRED', 'Administrator access is required'));
    }
    return next();
  }

  function requireSelfOrAdmin(param = 'employeeId') {
    return function enforceSelfOrAdmin(req, res, next) {
      const targetEmployeeId = String(req.params[param] || '').trim();
      const isSelf = String(req.employee?.employeeId || '') === targetEmployeeId;
      if (!isSelf && req.employee?.role !== 'admin') {
        return next(new AppError(403, 'FORBIDDEN', 'You may only access your own employee record'));
      }
      return next();
    };
  }

  return { requireAdmin, requireAuth, requireSelfOrAdmin };
}

module.exports = { createAuthMiddleware };
