class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
}

function errorHandler(logger = console) {
  return function handleError(error, req, res, next) {
    if (res.headersSent) {
      return next(error);
    }

    const normalized = normalizeError(error);
    if (normalized.status >= 500) {
      logger.error('Unhandled request error', {
        method: req.method,
        path: req.originalUrl,
        message: error.message,
      });
    }

    const body = {
      error: {
        code: normalized.code,
        message: normalized.message,
      },
    };
    if (normalized.details !== undefined) {
      body.error.details = normalized.details;
    }

    return res.status(normalized.status).json(body);
  };
}

function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error && error.code === 11000) {
    return new AppError(409, 'CONFLICT', 'A resource with that identifier already exists');
  }

  if (error && (error.name === 'ValidationError' || error.name === 'CastError')) {
    return new AppError(400, 'VALIDATION_ERROR', 'The request contains invalid data');
  }

  if (error && error.name === 'MulterError') {
    return new AppError(400, 'INVALID_UPLOAD', error.message);
  }

  return new AppError(500, 'INTERNAL_ERROR', 'Internal server error');
}

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
  normalizeError,
};
