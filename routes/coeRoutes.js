const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const tenantIsolation = require('../middleware/tenantIsolation');
const {
  getDashboardStats,
  createExam,
  getExams,
  updateExam,
  deleteExam,
  publishExam,
  createSchedule,
  getExamSchedules,
  updateSchedule,
  deleteSchedule,
  publishTimetable,
  getHallTickets,
  generateBulkHallTickets,
  updateHallTicketStatus,
  allocateSeating,
  getSeatingArrangements,
  assignInvigilation,
  getInvigilationDuties,
  getInternalMarks,
  verifyInternalMark,
  getInternalDiscrepancyReport,
  uploadExternalMarks,
  bulkUploadExternalMarks,
  processSemesterResults,
  getExamResults,
  publishExamResults,
  applyRevaluation,
  getRevaluationRequests,
  updateRevaluationStatus,
  updateMalpractice,
  deleteMalpractice,
  saveExamAttendance,
  getExamAttendance,
  publishNotification,
  searchStudentExams,
  getAuditLogs,
  updateProfile
} = require('../controllers/coeController');

router.use(protect);
router.use(requireRole(['coe', 'exam_cell', 'super_admin']));
router.use(tenantIsolation);

// Stats & Dashboard
router.get('/dashboard-stats', getDashboardStats);

// 2. Exam Management
router.post('/exams', createExam);
router.get('/exams', getExams);
router.put('/exams/:id', updateExam);
router.delete('/exams/:id', deleteExam);
router.post('/exams/:id/publish', publishExam);

// 3. Timetable Schedules
router.post('/exam-schedules', createSchedule);
router.get('/exam-schedules', getExamSchedules);
router.put('/exam-schedules/:id', updateSchedule);
router.delete('/exam-schedules/:id', deleteSchedule);
router.post('/exam-schedules/publish', publishTimetable);

// 4. Hall Tickets
router.get('/hall-tickets', getHallTickets);
router.post('/hall-tickets/generate', generateBulkHallTickets);
router.put('/hall-tickets/:id/status', updateHallTicketStatus);

// 5. Seating Arrangement
router.post('/seating/allocate', allocateSeating);
router.get('/seating', getSeatingArrangements);

// 6. Invigilation Duty
router.post('/invigilation', assignInvigilation);
router.get('/invigilation', getInvigilationDuties);

// 7. Internal Marks Verification
router.get('/internal-marks', getInternalMarks);
router.put('/internal-marks/:id/verify', verifyInternalMark);
router.get('/internal-marks/discrepancies', getInternalDiscrepancyReport);

// 8. External Marks
router.post('/external-marks', uploadExternalMarks);
router.post('/external-marks/bulk', bulkUploadExternalMarks);

// 9. Results Processing & Grace Marks
router.post('/results/process', processSemesterResults);
router.put('/results/:id/publish', publishExamResults);
router.get('/results', getExamResults);

// 10. Revaluation & Supplementary
router.post('/revaluation', applyRevaluation);
router.get('/revaluation', getRevaluationRequests);
router.put('/revaluation/:id/status', updateRevaluationStatus);

// 11. Malpractice Management
router.put('/malpractices/:id', updateMalpractice);
router.delete('/malpractices/:id', deleteMalpractice);

// 12. Exam Attendance
router.post('/exam-attendance', saveExamAttendance);
router.get('/exam-attendance', getExamAttendance);

// 13. Notifications Board
router.post('/notifications', publishNotification);

// 14. Student Search
router.get('/students/search', searchStudentExams);

// 15. Audit Logs
router.get('/audit-logs', getAuditLogs);

// 16. My Profile
router.put('/profile', updateProfile);

module.exports = router;
