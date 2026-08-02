/**
 * Shared utility helpers for ID generation, standardized API formatting, and pagination.
 */
const crypto = require('crypto');

/**
 * Generates an opaque, formatted public ID (e.g. POST_A1B2C3D4)
 * @param {string} prefix 
 * @returns {string}
 */
const generatePublicId = (prefix) => {
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix.toUpperCase()}_${randomHex}`;
};

/**
 * Sends a standardized success API response
 */
const sendSuccess = (res, message, data = {}, statusCode = 200, pagination = null) => {
  const payload = {
    success: true,
    message,
    data
  };
  if (pagination) {
    payload.pagination = pagination;
  }
  return res.status(statusCode).json(payload);
};

/**
 * Sends a standardized failure API response
 */
const sendFailure = (res, message, errorCode = 'INTERNAL_ERROR', details = [], statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code: errorCode,
      details: Array.isArray(details) ? details : [{ message: details }]
    }
  });
};

/**
 * Formats database pagination metadata
 */
const formatPagination = (currentPage, limit, totalItems) => {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    currentPage: parseInt(currentPage, 10),
    totalPages,
    totalItems,
    itemsPerPage: parseInt(limit, 10),
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
};

module.exports = {
  generatePublicId,
  sendSuccess,
  sendFailure,
  formatPagination
};
