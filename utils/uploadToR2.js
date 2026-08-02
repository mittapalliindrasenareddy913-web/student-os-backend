const { Upload } = require('@aws-sdk/lib-storage');
const { s3Client, bucketName, publicUrl } = require('../config/r2');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * Uploads a file buffer or stream to Cloudflare R2
 * @param {Buffer|Stream} fileSource - File content
 * @param {string} originalName - Original filename
 * @param {string} mimeType - File MIME type
 * @param {string} folder - Folder path (e.g., 'profile', 'community')
 * @returns {Promise<object>} File metadata including publicUrl
 */
const uploadToR2 = async (fileSource, originalName, mimeType, folder = 'temp') => {
  const sanitizedFolder = folder.replace(/\/+$/, ''); // remove trailing slash
  
  // Sanitize filename to avoid path traversal/security issues
  const cleanOriginalName = path.basename(originalName);
  const extension = path.extname(cleanOriginalName) || '';
  
  // Generate UUID filename as requested
  const uniqueName = `${uuidv4()}${extension}`;
  const key = `${sanitizedFolder}/${uniqueName}`;

  // Prevent uploads of executable files
  const lowercaseExt = extension.toLowerCase();
  const blockedExtensions = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.com', '.vbs', '.scr', '.js', '.ts', '.bin'];
  if (blockedExtensions.includes(lowercaseExt) || mimeType.includes('application/x-msdownload') || mimeType.includes('application/octet-stream') && blockedExtensions.includes(lowercaseExt)) {
    throw new Error('File type is blocked for security reasons.');
  }

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: key,
      Body: fileSource,
      ContentType: mimeType,
    },
  });

  await upload.done();

  return {
    fileName: uniqueName,
    originalName: cleanOriginalName,
    mimeType,
    size: fileSource.length || 0,
    folder: sanitizedFolder,
    publicUrl: `${publicUrl.replace(/\/+$/, '')}/${key}`,
  };
};

module.exports = uploadToR2;
