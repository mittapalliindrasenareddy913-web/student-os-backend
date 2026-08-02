/**
 * Enterprise Structured Logger using Winston with Log Rotation.
 */
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('../config/environment');

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization', 'refreshToken', 'fcmToken', 'otp'];

// Format to redact sensitive credentials
const redactSensitive = format((info) => {
  if (info.meta && typeof info.meta === 'object') {
    const redacted = { ...info.meta };
    SENSITIVE_KEYS.forEach(k => {
      if (k in redacted) redacted[k] = '[REDACTED]';
    });
    info.meta = redacted;
  }
  if (info.body && typeof info.body === 'object') {
    const redacted = { ...info.body };
    SENSITIVE_KEYS.forEach(k => {
      if (k in redacted) redacted[k] = '[REDACTED]';
    });
    info.body = redacted;
  }
  return info;
});

// JSON formatter helper
const jsonFormat = format.combine(
  redactSensitive(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format((info) => {
    // Under production, we omit the stack trace to protect source exposure
    if (config.env === 'production' && info.stack) {
      delete info.stack;
    }
    return info;
  })(),
  format.json()
);

const logger = createLogger({
  level: config.logLevel,
  format: jsonFormat,
  transports: [
    new transports.Console({
      format: config.env === 'production'
        ? jsonFormat
        : format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, reqId, ...meta }) => {
              const trace = reqId ? ` [${reqId}]` : '';
              const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `[${timestamp}] ${level}:${trace} ${message}${metaStr}`;
            })
          )
    })
  ]
});

// Configure rotating log files for Production / Staging
const logDir = path.join(__dirname, '../../logs');

// Add specific category rotations
logger.add(new DailyRotateFile({
  filename: path.join(logDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'info'
}));

logger.add(new DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error'
}));

// Specialized transports for security logs and audit logs
const securityLogger = createLogger({
  level: 'info',
  format: jsonFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d'
    })
  ]
});

const auditLogger = createLogger({
  level: 'info',
  format: jsonFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '50m',
      maxFiles: '365d' // retain for 1 year
    })
  ]
});

module.exports = {
  logger,
  securityLogger,
  auditLogger
};
