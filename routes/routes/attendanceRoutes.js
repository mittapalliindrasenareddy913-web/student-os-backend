const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getSubjects, addSubject, updateSubject, deleteSubject,
  markClass, deleteRecord,
  getSummary, getHeatmap, getAnalytics,
} = require('../controllers/attendanceController');

router.use(protect);

// Overview
router.get('/summary',              getSummary);

// Subjects CRUD
router.get('/',                     getSubjects);
router.post('/',                    addSubject);
router.put('/:id',                  updateSubject);
router.delete('/:id',               deleteSubject);

// Records
router.post('/:id/record',          markClass);
router.delete('/:id/record/:recordId', deleteRecord);

// Analytics
router.get('/:id/heatmap',          getHeatmap);
router.get('/:id/analytics',        getAnalytics);

module.exports = router;
