/**
 * Decoupled Background Worker Queue with Graceful Outage Fallback.
 * Safely executes asynchronous operations like notification dispatchers.
 */
const { redis, isRedisAvailable } = require('../cache/redis');
const { logger } = require('../logging/logger');

const localQueue = [];
let localQueueProcessing = false;

// Process the local loop queue in the background
const processLocalQueue = async () => {
  if (localQueueProcessing || localQueue.length === 0) return;
  localQueueProcessing = true;

  while (localQueue.length > 0) {
    const job = localQueue.shift();
    try {
      await job.handler(job.payload);
    } catch (err) {
      logger.error('Background job failed in execution', {
        jobName: job.name,
        error: err.message
      });
    }
  }

  localQueueProcessing = false;
};

/**
 * Adds a job to the background processing queue.
 * Falls back to local event loop dispatch if Redis/Bull is down.
 */
const enqueueJob = async (jobName, payload, handler) => {
  try {
    if (isRedisAvailable() && redis) {
      // Push job into a Redis list (queue)
      await redis.lpush(`queue:${jobName}`, JSON.stringify(payload));
      
      // Trigger async processing using a non-blocking worker thread loop
      setImmediate(async () => {
        try {
          const popped = await redis.rpop(`queue:${jobName}`);
          if (popped) {
            await handler(JSON.parse(popped));
          }
        } catch (err) {
          logger.error('Redis background job execution failed', { jobName, error: err.message });
          // Fall back to direct execution on failure
          await handler(payload);
        }
      });
    } else {
      // Local fallback queue
      localQueue.push({ name: jobName, payload, handler });
      setImmediate(processLocalQueue);
    }
  } catch (err) {
    logger.warn('Queue client failed. Executing job synchronously.', { jobName, error: err.message });
    // Emergency synchronous fallback
    try {
      await handler(payload);
    } catch (handlerErr) {
      logger.error('Emergency sync job execution failed', { jobName, error: handlerErr.message });
    }
  }
};

module.exports = {
  enqueueJob
};
