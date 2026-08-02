const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const tenantIsolation = require('../middleware/tenantIsolation');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});
const {
  addSubject,
  getSubjects,
  updateSubject,
  deleteSubject,
  createAssignment,
  createExamTimetable,
  createPlacementDrive,
  registerBook,
  issueBook,
  parseImportFile,
  validateImportData,
  executeImportData,
  getImportHistory,
  getImportErrors,
  rollbackImport,
  getErpStats,
  getImportLockStatus
} = require('../controllers/erpController');
const Timetable = require('../models/Timetable');
const Material = require('../models/Material');

router.use(protect);
router.use(tenantIsolation);

// ── Student / Faculty timetable viewer (read-only) ──
router.get('/timetable', async (req, res) => {
  try {
    const { collegeCode } = req.user;
    let query = { collegeCode };
    // Students: filter by their branch+year+section; Faculty: all assigned dept
    if (req.user.role === 'student') {
      if (req.user.branch)   query.department = req.user.branch;
      if (req.user.year)     query.year = Number(req.user.year);
      if (req.user.section)  query.section = req.user.section;
    } else if (req.user.role === 'faculty') {
      if (req.user.assignedDepartment) query.department = req.user.assignedDepartment;
    }
    const data = await Timetable.find(query)
      .populate('slots.facultyId', 'fullName')
      .populate({
        path: 'slots.subjects',
        populate: { path: 'faculty', select: 'fullName employeeId' }
      })
      .lean();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Student study materials viewer (read-only) ──
router.get('/materials', async (req, res) => {
  try {
    const { collegeCode } = req.user;
    const query = { collegeCode };
    // Filter by student's branch/department if available
    if (req.user.role === 'student' && req.user.branch) {
      query.department = req.user.branch;
    } else if (req.user.role === 'faculty' && req.user.assignedDepartment) {
      query.department = req.user.assignedDepartment;
    }
    const data = await Material.find(query).sort({ createdAt: -1 }).lean();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Subjects routes
router.post('/subjects', requireRole(['principal', 'hod']), addSubject);
router.get('/subjects', requireRole(['principal', 'hod', 'faculty']), getSubjects);
router.put('/subjects/:id', requireRole(['principal', 'hod']), updateSubject);
router.delete('/subjects/:id', requireRole(['principal', 'hod']), deleteSubject);

// Assignments routes
router.post('/assignments', requireRole(['hod', 'faculty']), createAssignment);

// Exam cell routes
router.post('/exams', requireRole(['principal', 'super_admin']), createExamTimetable);

// Placement drives routes
router.post('/placements', requireRole(['principal']), createPlacementDrive);

// Library routes
router.post('/library/register', requireRole(['principal', 'super_admin']), registerBook);
router.post('/library/issue', requireRole(['principal']), issueBook);

// ERP Import routes
router.post('/import/parse', requireRole(['principal']), upload.any(), parseImportFile);
router.post('/import/validate', requireRole(['principal']), validateImportData);
router.post('/import', requireRole(['principal']), executeImportData);
router.get('/import/history', requireRole(['principal']), getImportHistory);
router.get('/imports/history', requireRole(['principal']), getImportHistory);
router.get('/import/history/:id/errors', requireRole(['principal']), getImportErrors);
router.post('/import/history/:id/rollback', requireRole(['principal']), rollbackImport);
router.get('/import/stats', requireRole(['principal']), getErpStats);
router.get('/imports/lock-status', requireRole(['principal']), getImportLockStatus);

module.exports = router;
