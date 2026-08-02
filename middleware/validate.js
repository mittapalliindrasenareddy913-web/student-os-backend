/**
 * Campus OS — Input Validation Middleware
 * Wraps express-validator to return consistent 422 error responses.
 */
const { validationResult } = require('express-validator');

/**
 * Runs after express-validator chains. Returns 422 with field-level errors
 * if any validation rule was violated.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: 'Validation failed. Please check your inputs.',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

module.exports = { validate };
