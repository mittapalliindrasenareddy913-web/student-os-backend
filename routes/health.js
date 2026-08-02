/**
 * Comprehensive System Health & Diagnostics Endpoint.
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { s3Client, bucketName } = require('../config/r2');
const { isRedisAvailable } = require('../shared/cache/redis');
const { sendSuccess, sendFailure } = require('../shared/utils/helpers');

router.get('/health', async (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    timestamp: new Date(),
    services: {
      database: 'DOWN',
      cache: 'DOWN',
      storage: 'DOWN',
      queue: 'UP' // Local event loop queue is always UP
    }
  };

  try {
    // 1. Verify MongoDB Connection
    if (mongoose.connection.readyState === 1) {
      healthCheck.services.database = 'UP';
    }

    // 2. Verify Redis Connection
    if (isRedisAvailable()) {
      healthCheck.services.cache = 'UP';
    }

    // 3. Verify Cloudflare R2 Connection
    try {
      await s3Client.send(new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1
      }));
      healthCheck.services.storage = 'UP';
    } catch (s3Err) {
      healthCheck.services.storage = `DOWN (${s3Err.message})`;
    }

    // Determine status
    const allServicesUp = 
      healthCheck.services.database === 'UP' &&
      healthCheck.services.cache === 'UP' &&
      healthCheck.services.storage === 'UP';

    if (allServicesUp) {
      return sendSuccess(res, 'System is healthy.', healthCheck, 200);
    } else {
      return res.status(503).json({
        success: false,
        message: 'System is degraded.',
        error: {
          code: 'SYSTEM_DEGRADED',
          details: [healthCheck]
        }
      });
    }
  } catch (err) {
    return sendFailure(res, 'Health check failed.', 'HEALTH_CHECK_FAILED', err.message, 500);
  }
});

module.exports = router;
