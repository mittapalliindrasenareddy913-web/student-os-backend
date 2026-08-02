/**
 * Feature Flags Configuration Registry
 */
const { logger } = require('../logging/logger');

const FEATURE_FLAGS = {
  community_feed_active: true,
  media_optimization_active: true,
  redis_cache_active: true,
  gamification_badges_active: true,
  notifications_worker_active: true
};

const isFeatureActive = (flagName) => {
  // Check if overridden by environment variable, else fallback to default map
  const envVar = `FEATURE_${flagName.toUpperCase()}`;
  if (process.env[envVar] !== undefined) {
    return process.env[envVar] === 'true';
  }
  return FEATURE_FLAGS[flagName] !== undefined ? FEATURE_FLAGS[flagName] : false;
};

const checkFeature = (flagName) => {
  return (req, res, next) => {
    if (!isFeatureActive(flagName)) {
      logger.warn(`Attempt to access disabled feature flag: ${flagName}`, {
        ip: req.ip,
        reqId: req.reqId
      });
      return res.status(503).json({
        success: false,
        message: 'Feature temporarily unavailable.',
        error: {
          code: 'FEATURE_DISABLED',
          details: [{ message: `The feature '${flagName}' is disabled in this environment.` }]
        }
      });
    }
    next();
  };
};

module.exports = {
  isFeatureActive,
  checkFeature,
  FEATURE_FLAGS
};
