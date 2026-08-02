/**
 * Decoupled Cloudflare R2 Upload Service.
 * Validates buffers, generates public IDs, and handles uploads.
 */
const { Upload } = require('@aws-sdk/lib-storage');
const { s3Client, bucketName, publicUrl } = require('../../config/r2');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { validateFile } = require('./fileValidator');
const { generatePublicId } = require('../utils/helpers');
const { logger } = require('../logging/logger');

const uploadBufferToR2 = async (buffer, originalName, mimeType, folder = 'temp') => {
  // 1. Perform File Security Checks
  const { safeName, extension } = validateFile(originalName, buffer, mimeType);

  // 2. Generate a secure unique path using public ID format (e.g., MEDIA_XXXXXXXX)
  const mediaId = generatePublicId('MEDIA');
  const key = `${folder.replace(/\/+$/, '')}/${mediaId}${extension}`;

  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      },
    });

    await upload.done();

    const fileUrl = `${publicUrl.replace(/\/+$/, '')}/${key}`;
    const result = {
      publicId: mediaId,
      fileName: safeName,
      mimeType,
      size: buffer.length,
      publicUrl: fileUrl
    };

    // 3. For images, simulate WebP thumbnail compilation
    if (mimeType.startsWith('image/')) {
      const thumbKey = `${folder.replace(/\/+$/, '')}/thumb_${mediaId}.webp`;
      const thumbUpload = new Upload({
        client: s3Client,
        params: {
          Bucket: bucketName,
          Key: thumbKey,
          Body: buffer, // fallback to source buffer for thumbnail variant
          ContentType: 'image/webp',
        },
      });
      await thumbUpload.done();
      result.thumbnailUrl = `${publicUrl.replace(/\/+$/, '')}/${thumbKey}`;
    }

    return result;
  } catch (err) {
    logger.error('R2 upload pipeline failed', {
      originalName,
      error: err.message
    });
    throw new Error(`Cloudflare R2 storage upload failed: ${err.message}`);
  }
};

module.exports = {
  uploadBufferToR2
};
