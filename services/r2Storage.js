const uploadToR2 = require('../utils/uploadToR2');
const deleteFromR2 = require('../utils/deleteFromR2');

/**
 * Cloudflare R2 High-level Storage Service
 */
const r2Storage = {
  /**
   * Upload file buffer to R2
   */
  async uploadFile(fileBuffer, originalName, mimeType, folder) {
    return await uploadToR2(fileBuffer, originalName, mimeType, folder);
  },

  /**
   * Upload file stream to R2
   */
  async uploadStream(fileStream, originalName, mimeType, folder) {
    return await uploadToR2(fileStream, originalName, mimeType, folder);
  },

  /**
   * Delete file from R2
   */
  async deleteFile(fileUrlOrKey) {
    return await deleteFromR2(fileUrlOrKey);
  }
};

module.exports = r2Storage;
