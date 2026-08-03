const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const tenantIsolation = require('../middleware/tenantIsolation');
const {
  getDashboardStats,
  // Attendance monitoring
  getHodAttendance,
  getHodAttendanceHistory,
  getHodAttendanceAnalytics,
  getFacultySubmissionStatus,
  // Timetable
  saveTimetable,
  getTimetables,
  // Leaves
  getLeaveRequests,
  recommendLeave,
  rejectLeave,
  // Marks
  getExamMarks,
  approveExamMarks,
  rejectExamMarks,
  // Materials
  uploadMaterial,
  getMaterials,
  // Students
  uploadStudents,
  getDepartmentStudents,
  getDepartmentFaculty,
  getDepartmentSubjects,
  createDepartmentSubject,
  bulkImportSubjects,
  getDepartmentNotices,
  publishDepartmentNotice,
  actionStudentLeave,
  updateFacultyAssignments,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkActionStudents,
  parseFileForTimetable,
  bulkSaveTimetables,
  clearAllTimetables,
  clearSectionTimetable,
  getAllCollegeFaculty,
  getTimetableAnalytics,
  restoreTimetableVersion
} = require('../controllers/hodController');

router.use(protect);

// Faculty directory across all departments
router.get('/faculty/all-departments', tenantIsolation, requireRole(['hod', 'faculty']), getAllCollegeFaculty);

// Timetable Analytics & Versioning
router.get('/timetable/analytics', tenantIsolation, requireRole(['hod', 'faculty', 'principal']), getTimetableAnalytics);
router.post('/timetable/restore-version', tenantIsolation, requireRole(['hod', 'principal']), restoreTimetableVersion);

// Timetable (Accessible by both HOD and Faculty)
router.post('/timetable/parse-file', tenantIsolation, requireRole(['hod', 'faculty']), parseFileForTimetable);
router.post('/timetable/bulk-save', tenantIsolation, requireRole(['hod', 'faculty']), bulkSaveTimetables);
router.delete('/timetable/all', tenantIsolation, requireRole(['hod', 'faculty']), clearAllTimetables);
router.delete('/timetable/section/:year/:section', tenantIsolation, requireRole(['hod', 'faculty']), clearSectionTimetable);
router.post('/timetable', tenantIsolation, requireRole(['hod', 'faculty']), saveTimetable);
router.get('/timetable', tenantIsolation, requireRole(['hod', 'faculty']), getTimetables);

router.use(requireRole(['hod']));
router.use(tenantIsolation);

// Stats
router.get('/dashboard-stats', getDashboardStats);

// Attendance Monitoring (Step 8)
router.get('/attendance/history',   getHodAttendanceHistory);
router.get('/attendance/analytics', getHodAttendanceAnalytics);
router.get('/attendance',           getHodAttendance);
router.get('/faculty-submission-status', getFacultySubmissionStatus);

// Faculty leaves approvals recommendation
router.get('/leaves', getLeaveRequests);
router.post('/leaves/:id/recommend', recommendLeave);
router.post('/leaves/:id/reject', rejectLeave);

// Internal Marks approval verify
router.get('/marks', getExamMarks);
router.post('/marks/:id/approve', approveExamMarks);
router.post('/marks/:id/reject', rejectExamMarks);

// Department repository uploader
router.get('/materials', getMaterials);
router.post('/materials', uploadMaterial);

// Student master roster
router.get('/students', getDepartmentStudents);
router.post('/students', createStudent);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);
router.post('/students/bulk-action', bulkActionStudents);
router.post('/students/import', uploadStudents);

// Faculty listing & assignments
router.get('/faculty', getDepartmentFaculty);
router.post('/faculty', createFaculty);
router.put('/faculty/:id', updateFaculty);
router.delete('/faculty/:id', deleteFaculty);
router.put('/faculty/:id/assignments', updateFacultyAssignments);

// Department Subjects
router.get('/subjects', getDepartmentSubjects);
router.post('/subjects/bulk', bulkImportSubjects);
router.post('/subjects', createDepartmentSubject);

// Department Notices Board
router.get('/notices', getDepartmentNotices);
router.post('/notices', publishDepartmentNotice);

// Student leaves approvals direct action
router.post('/leaves/student/:id/action', actionStudentLeave);

module.exports = router;
