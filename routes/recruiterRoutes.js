const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const {
  createJobDrive,
  getJobDrives,
  getEligibleStudents,
  getApplications,
  updateApplicationStatus
} = require('../controllers/recruiterController');

router.use(protect);
router.use(requireRole(['recruiter']));

router.post('/drives', createJobDrive);
router.get('/drives', getJobDrives);
router.get('/students', getEligibleStudents);
router.get('/applications', getApplications);
router.put('/applications/:applicationId', updateApplicationStatus);

module.exports = router;
