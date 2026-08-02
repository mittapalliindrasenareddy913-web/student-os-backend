const multer = require('multer');
const uploadToR2 = require('../utils/uploadToR2');
const path = require('path');

// Multer memory storage to hold files in memory before uploading to R2
const memoryStorage = multer.memoryStorage();

// Raw multer instances with limits
const rawAvatarUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const rawPostUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware for avatar fields upload
const avatarMiddleware = (req, res, next) => {
  const uploadFields = rawAvatarUpload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'coverPhoto', maxCount: 1 },
    { name: 'resume', maxCount: 1 }
  ]);

  uploadFields(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ message: err.message });
    }

    if (!req.files) return next();

    try {
      // Process avatar
      if (req.files.avatar && req.files.avatar[0]) {
        const file = req.files.avatar[0];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          return res.status(400).json({ message: 'Avatar must be an image (jpg, jpeg, png, webp).' });
        }
        const result = await uploadToR2(file.buffer, file.originalname, file.mimetype, 'profile');
        file.path = result.publicUrl;
      }

      // Process coverPhoto
      if (req.files.coverPhoto && req.files.coverPhoto[0]) {
        const file = req.files.coverPhoto[0];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          return res.status(400).json({ message: 'Cover photo must be an image (jpg, jpeg, png, webp).' });
        }
        const result = await uploadToR2(file.buffer, file.originalname, file.mimetype, 'profile');
        file.path = result.publicUrl;
      }

      // Process resume
      if (req.files.resume && req.files.resume[0]) {
        const file = req.files.resume[0];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.pdf', '.doc', '.docx'].includes(ext)) {
          return res.status(400).json({ message: 'Resume must be a PDF or Word document.' });
        }
        const result = await uploadToR2(file.buffer, file.originalname, file.mimetype, 'documents');
        file.path = result.publicUrl;
      }

      next();
    } catch (uploadErr) {
      return res.status(400).json({ message: uploadErr.message || 'File upload to R2 failed.' });
    }
  });
};

// Middleware for post single attachment
const postSingleMiddleware = (req, res, next) => {
  rawPostUpload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) return next();

    try {
      // Determine folder path
      let folder = 'posts';
      const mime = req.file.mimetype;
      if (mime.startsWith('image/')) folder = 'posts';
      else if (mime.startsWith('video/')) folder = 'videos';
      else if (mime.startsWith('audio/')) folder = 'audio';
      else if (mime.includes('pdf') || mime.includes('word') || mime.includes('document')) folder = 'documents';

      const result = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype, folder);
      req.file.path = result.publicUrl;
      next();
    } catch (uploadErr) {
      return res.status(400).json({ message: uploadErr.message || 'File upload to R2 failed.' });
    }
  });
};

// Middleware for post array attachments
const postArrayMiddleware = (req, res, next) => {
  rawPostUpload.array('files', 5)(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ message: err.message });
    }

    if (!req.files || req.files.length === 0) return next();

    try {
      for (const file of req.files) {
        let folder = 'posts';
        const mime = file.mimetype;
        if (mime.startsWith('image/')) folder = 'posts';
        else if (mime.startsWith('video/')) folder = 'videos';
        else if (mime.startsWith('audio/')) folder = 'audio';
        else if (mime.includes('pdf') || mime.includes('word') || mime.includes('document')) folder = 'documents';

        const result = await uploadToR2(file.buffer, file.originalname, file.mimetype, folder);
        file.path = result.publicUrl;
      }
      next();
    } catch (uploadErr) {
      return res.status(400).json({ message: uploadErr.message || 'File upload to R2 failed.' });
    }
  });
};

// Custom helper middleware mimicking multer object methods for compatibility
const uploadAvatar = {
  fields: () => avatarMiddleware,
  single: (fieldName) => (req, res, next) => {
    rawAvatarUpload.single(fieldName)(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return next();
      try {
        const result = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype, 'profile');
        req.file.path = result.publicUrl;
        next();
      } catch (uploadErr) {
        return res.status(400).json({ message: uploadErr.message });
      }
    });
  }
};

const uploadPostAttachment = {
  single: () => postSingleMiddleware,
  array: () => postArrayMiddleware
};

module.exports = {
  uploadAvatar,
  uploadPostAttachment
};
