const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getDashboardData,
  forgotPassword,
  verifyOtpAndReset,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const upload = require('../middleware/uploadMiddleware');

// Public
router.post('/register',         registerUser);
router.post('/login',            loginUser);
router.post('/forgot-password',  forgotPassword);
router.post('/reset-password',   verifyOtpAndReset);

// Protected
router.get ('/profile',   protect, getUserProfile);
router.put ('/profile',   protect, upload.single('avatar'), updateUserProfile);
router.get ('/dashboard', protect, getDashboardData);

module.exports = router;
