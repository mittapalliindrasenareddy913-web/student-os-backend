const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const {
  addMasterCollege,
  getAllColleges,
  approveCollegeActivation,
  toggleCollegeStatus,
  getPlatformAnalytics
} = require('../controllers/superAdminController');

// All Super Admin routes are protected by JWT check and Super Admin role check
router.use(protect);
router.use(requireRole(['superadmin', 'super_admin']));

router.post('/colleges', addMasterCollege);
router.get('/colleges', getAllColleges);
router.post('/colleges/:code/approve', approveCollegeActivation);
router.post('/colleges/:code/suspend', toggleCollegeStatus);
router.get('/analytics', getPlatformAnalytics);

module.exports = router;
