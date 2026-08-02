const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const tenantIsolation = require('../middleware/tenantIsolation');
const { getStudentTimetable } = require('../controllers/studentController');

router.use(protect);
router.use(tenantIsolation);

router.get('/timetable', getStudentTimetable);

module.exports = router;
