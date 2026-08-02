/**
 * Redis Cache wrapper utilizing ioredis with transparent fallback.
 */
const Redis = require('ioredis');
const config = require('../config/environment');
const { logger } = require('../logging/logger');

let redis = null;
let isRedisAvailable = false;

if (config.redisUrl && config.enableCache) {
  try {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn('Redis connection failed permanently. Disabling cache layer fallback.');
          isRedisAvailable = false;
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      }
    });

    redis.on('connect', () => {
      logger.info('Connected to Redis server successfully.');
      isRedisAvailable = true;
    });

    redis.on('error', (err) => {
      logger.warn('Redis connection error occurred. Direct DB queries active.', { error: err.message });
      isRedisAvailable = false;
    });
  } catch (err) {
    logger.warn('Failed to initialize Redis client. Direct DB queries active.', { error: err.message });
    isRedisAvailable = false;
  }
}

// Helper methods with safe fallback
const cacheGet = async (key) => {
  if (!isRedisAvailable || !redis) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    logger.warn('Redis GET failure. Falling back.', { key, error: err.message });
    return null;
  }
};

const cacheSet = async (key, value, ttlSeconds = 900) => {
  if (!isRedisAvailable || !redis) return false;
  try {
    const stringified = JSON.stringify(value);
    await redis.set(key, stringified, 'EX', ttlSeconds);
    return true;
  } catch (err) {
    logger.warn('Redis SET failure. Falling back.', { key, error: err.message });
    return false;
  }
};

const cacheDel = async (key) => {
  if (!isRedisAvailable || !redis) return false;
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    logger.warn('Redis DEL failure. Falling back.', { key, error: err.message });
    return false;
  }
};

const cacheDelPattern = async (pattern) => {
  if (!isRedisAvailable || !redis) return false;
  try {
    const keys = await redis.keys(pattern);
    if (keys && keys.length > 0) {
      await redis.del(...keys);
    }
    return true;
  } catch (err) {
    logger.warn('Redis Pattern DEL failure. Falling back.', { pattern, error: err.message });
    return false;
  }
};

module.exports = {
  redis,
  isRedisAvailable: () => isRedisAvailable,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern
};
