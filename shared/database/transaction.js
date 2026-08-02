/**
 * MongoDB Transaction Utility Helper
 * Supports replica set transactions with graceful fallback for standalone instances.
 */
const mongoose = require('mongoose');
const { logger } = require('../logging/logger');

const runInTransaction = async (workFn) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await workFn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    logger.warn('Transaction aborted due to error, rolling back changes', { error: error.message });
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    // Check if error is due to transactions not supported (e.g., standalone MongoDB)
    if (error.codeName === 'CommandNotSupported' || error.message.includes('transaction')) {
      logger.warn('Transactions not supported by server. Executing callback standalone without transaction boundaries.');
      return await workFn(null);
    }
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = {
  runInTransaction
};
