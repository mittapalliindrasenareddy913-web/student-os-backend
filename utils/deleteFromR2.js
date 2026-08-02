const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, bucketName } = require('../config/r2');

/**
 * Deletes an object from Cloudflare R2
 * @param {string} fileUrlOrKey - Public URL of the file or the direct R2 Key
 * @returns {Promise<boolean>} Success status
 */
const deleteFromR2 = async (fileUrlOrKey) => {
  if (!fileUrlOrKey) return false;

  // Extract key from URL if a URL is provided
  let key = fileUrlOrKey;
  if (fileUrlOrKey.startsWith('http://') || fileUrlOrKey.startsWith('https://')) {
    try {
      const url = new URL(fileUrlOrKey);
      // pathname will be "/folder/uuid.ext"
      key = decodeURIComponent(url.pathname.substring(1));
    } catch (e) {
      console.error('Error parsing file URL for deletion:', e);
      return false;
    }
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (err) {
    console.error(`Failed to delete object from R2: ${key}`, err);
    return false;
  }
};

module.exports = deleteFromR2;
