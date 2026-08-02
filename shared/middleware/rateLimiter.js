/**
 * Endpoint-specific rate limiting middleware.
 */
const rateLimit = require('express-rate-limit');
const config = require('../config/environment');
const { logger } = require('../logging/logger');

// Multiplier adjusts rates during tests to prevent flaky failures
const multiplier = config.rateLimitMultiplier || 1;

const createLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 60000,
    max: Math.ceil((options.max || 100) * multiplier),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        url: req.originalUrl,
        reqId: req.reqId,
        userId: req.user ? req.user._id : 'anonymous'
      });
      res.status(429).json({
        success: false,
        message: options.message || 'Too many requests. Please try again later.',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          details: [{ message: 'Rate limit threshold exceeded.' }]
        }
      });
    },
    ...options
  });
};

const authLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many auth requests. Please try again in a minute.'
});

const postCommentLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many posts or comments. Please slow down.'
});

const socialActionLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many actions. Please slow down.'
});

const reportLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many reports submitted. Please wait before reporting again.'
});

const uploadLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many uploads. Please wait a moment.'
});

const searchLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many search requests. Please slow down.'
});

module.exports = {
  authLimiter,
  postCommentLimiter,
  socialActionLimiter,
  reportLimiter,
  uploadLimiter,
  searchLimiter
};
