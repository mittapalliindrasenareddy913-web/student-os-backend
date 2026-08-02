/**
 * Environment Configuration Registry
 * Isolates settings based on NODE_ENV.
 */
const dotenv = require('dotenv');
dotenv.config();

const env = process.env.NODE_ENV || 'development';

const baseConfig = {
  env,
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_student_os',
  logLevel: process.env.LOG_LEVEL || 'info',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL || 'https://pub-media.studentos.co'
  },
  slowQueryThresholdMs: parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '100', 10),
};

const configs = {
  development: {
    ...baseConfig,
    debug: true,
    enableCache: true,
    rateLimitMultiplier: 10
  },
  testing: {
    ...baseConfig,
    debug: true,
    enableCache: false,
    rateLimitMultiplier: 100,
    mongoUri: process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/studentos_test'
  },
  staging: {
    ...baseConfig,
    debug: false,
    enableCache: true,
    rateLimitMultiplier: 1.5
  },
  production: {
    ...baseConfig,
    debug: false,
    enableCache: true,
    rateLimitMultiplier: 1
  }
};

module.exports = configs[env] || configs.development;
