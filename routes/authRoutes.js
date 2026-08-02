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
  refreshToken,
  logoutUser,
  saveFcmToken,
  checkUsernameAvailability,
  googleLogin,
  connectGoogle,
  getConnectedAccounts,
  searchColleges,
  verifyRollNumber,
  linkRollNumber,
  collegeLogin,
  changePassword,
  collegeForgotPassword,
  collegeSendOtp,
  collegeVerifyOtp,
  collegeResetPassword,
  submitLead
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const { uploadAvatar } = require('../middleware/uploadMiddleware');

// Public
router.post('/login',            loginUser);
router.post('/register',         registerUser);
router.post('/google-login',     googleLogin);
router.post('/forgot-password',  forgotPassword);
router.post('/reset-password',   verifyOtpAndReset);
router.post('/refresh',          refreshToken);
router.post('/logout',           logoutUser);
router.get ('/colleges/search',  searchColleges);
router.post('/colleges/verify-roll', verifyRollNumber);
router.post('/leads', submitLead);

// Redesigned Authentication Flow
router.post('/college-login',           collegeLogin);
router.post('/college/forgot-password', collegeForgotPassword);
router.post('/college/send-otp',        collegeSendOtp);
router.post('/college/verify-otp',      collegeVerifyOtp);
router.post('/college/reset-password',  collegeResetPassword);

// Protected
router.get ('/profile',            protect, getUserProfile);
router.put ('/profile',            protect, uploadAvatar.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'coverPhoto', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]), updateUserProfile);
router.get ('/dashboard',          protect, getDashboardData);
router.post('/fcm-token',          protect, saveFcmToken);
router.post('/connect-google',     protect, connectGoogle);
router.get ('/connected-accounts', protect, getConnectedAccounts);
router.post('/colleges/link',      protect, linkRollNumber);
router.put ('/change-password',    protect, changePassword);

module.exports = router;
