/**
 * File validation and security inspection utilities.
 */
const path = require('path');
const mimeTypes = require('mime-types');

const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.com', '.vbs', '.scr', '.js', '.ts', '.bin', '.html', '.htm', '.php', '.py'];
const BLOCKED_MIME_TYPES = ['application/x-msdownload', 'text/html', 'application/javascript', 'application/x-sh'];

const validateFile = (originalName, buffer, mimeType, maxSizeMb = 10) => {
  const extension = path.extname(originalName).toLowerCase();
  
  // 1. Prevent Directory Traversal in filenames
  const safeName = path.basename(originalName);

  // 2. Extension Check
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    throw new Error('Upload blocked: Executable or scripting files are strictly prohibited.');
  }

  // 3. MIME Type Double-Check
  const lookupMime = mimeTypes.lookup(extension) || mimeType;
  if (BLOCKED_MIME_TYPES.includes(lookupMime) || BLOCKED_MIME_TYPES.includes(mimeType)) {
    throw new Error('Upload blocked: Prohibited MIME type.');
  }

  // 4. File Size boundary
  const fileSizeMb = buffer.length / (1024 * 1024);
  if (fileSizeMb > maxSizeMb) {
    throw new Error(`Upload blocked: File size exceeds the maximum limit of ${maxSizeMb}MB.`);
  }

  // 5. Image Integrity verification (Mock scan)
  if (mimeType.startsWith('image/')) {
    // Basic verification: Check if image starts with valid headers
    // JPEG starts with FF D8 FF
    // PNG starts with 89 50 4E 47
    // GIF starts with 47 49 46 38
    if (buffer.length < 4) {
      throw new Error('Upload blocked: Corrupt image file structure.');
    }
    const signature = buffer.slice(0, 4).toString('hex').toUpperCase();
    const isValidSignature = signature.startsWith('FFD8FF') || // JPEG
                             signature.startsWith('89504E47') || // PNG
                             signature.startsWith('47494638') || // GIF
                             signature.startsWith('52494646') || // WEBP (RIFF ...)
                             signature.startsWith('00000018') || // HEIC
                             signature.startsWith('00000020');   // HEIC
    
    if (!isValidSignature) {
      throw new Error('Upload blocked: Image integrity check failed (spoofed headers).');
    }
  }

  return { safeName, extension };
};

module.exports = {
  validateFile
};
