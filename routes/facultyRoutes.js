const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const tenantIsolation = require('../middleware/tenantIsolation');
const {
  getDashboardStats,
  getAssignedTimetable,
  getStudentsForAttendance,
  saveAttendance,
  getAttendanceLogs,
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  gradeAssignment,
  getPublishedMarks,
  submitExamMarks,
  getLabRecords,
  createLabRecord,
  updateLabRecord,
  deleteLabRecord,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  getAssignedStudents,
  getFacultyNotifications,
  updateProfileSettings,
  getClassDiary,
  createClassDiary,
  updateClassDiary,
  deleteClassDiary,
  applyLeaveRequest,
  getLeaveRequests,
  getDoubts,
  answerDoubt,
  getStudentAnalytics,
  getCalendarEvents
} = require('../controllers/facultyController');
const { setupFacultyProfile } = require('../controllers/campusAuthController');

router.use(protect);
router.use(requireRole(['faculty']));
router.use(tenantIsolation);

router.post('/setup-profile', setupFacultyProfile);

// 1. Stats
router.get('/dashboard-stats', getDashboardStats);

// 2. Timetable
router.get('/timetable', getAssignedTimetable);

// 3. Attendance
router.get('/attendance/students', getStudentsForAttendance);
router.post('/attendance', saveAttendance);
router.get('/attendance', getAttendanceLogs);

// 4 & 6. Materials / Notes Management
router.get('/materials', getMaterials);
router.post('/materials', createMaterial);
router.put('/materials/:id', updateMaterial);
router.delete('/materials/:id', deleteMaterial);

// 5. Assignments
router.get('/assignments', getAssignments);
router.post('/assignments', createAssignment);
router.put('/assignments/:id', updateAssignment);
router.delete('/assignments/:id', deleteAssignment);
router.post('/assignments/:id/grade', gradeAssignment);

// 7. Marks entry
router.get('/marks', getPublishedMarks);
router.post('/marks', submitExamMarks);

// 8. Lab records
router.get('/lab', getLabRecords);
router.post('/lab', createLabRecord);
router.put('/lab/:id', updateLabRecord);
router.delete('/lab/:id', deleteLabRecord);

// 9. Announcements
router.get('/announcements', getAnnouncements);
router.post('/announcements', createAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

// 10. Student roster
router.get('/students', getAssignedStudents);

// 11. System Notifications
router.get('/notifications', getFacultyNotifications);

// 12. Profile settings
router.put('/profile', updateProfileSettings);

// 13. Class Diary
router.get('/diary', getClassDiary);
router.post('/diary', createClassDiary);
router.put('/diary/:id', updateClassDiary);
router.delete('/diary/:id', deleteClassDiary);

// 14. Leaves
router.post('/leaves', applyLeaveRequest);
router.get('/leaves', getLeaveRequests);

// 15. Doubts
router.get('/doubts', getDoubts);
router.put('/doubts/:id/answer', answerDoubt);

// 16. Student analytics
router.get('/analytics', getStudentAnalytics);

// 17. Calendar events
router.get('/calendar', getCalendarEvents);

module.exports = router;
