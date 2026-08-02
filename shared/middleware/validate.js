/**
 * express-validator request validation result compiler middleware.
 */
const { validationResult } = require('express-validator');

const validatePayload = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details: formattedErrors
      }
    });
  }
  next();
};

module.exports = validatePayload;
