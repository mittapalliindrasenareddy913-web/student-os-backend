const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const tenantIsolation = require('../middleware/tenantIsolation');
const {
  getDashboardStats,
  createDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
  createHODAccount,
  getStaffAccounts,
  toggleHODAccount,
  resetHODPassword,
  publishNotice,
  getNotices,
  createCalendarItem,
  getCalendarItems,
  getCampusActivityLogs,
  getCollegeConfig,
  updateCollegeConfig,
  createUser,
  getUsers,
  updateUser,
  deleteUser,
  bulkImportUsers,
  bulkExportUsers,
  createStudentRecord,
  getStudentRecords,
  updateStudentRecord,
  deleteStudentRecord,
  bulkImportStudentRecords,
  bulkActionStudentRecords,
  bulkExportStudentRecords,
  getApprovalsQueue,
  actionApproval,
  getTimetablesQueue,
  actionTimetableApproval,
  createApprovalRequest,
  getWorkflowHistory,
  parseErpMasterPdf,
  confirmErpMasterImport
} = require('../controllers/principalController');

router.use(protect);

// ERP Metadata config & Notices GET (Accessible by all logged in roles)
router.get('/config', tenantIsolation, requireRole(['principal', 'hod', 'faculty', 'student']), getCollegeConfig);
router.get('/notices', tenantIsolation, requireRole(['principal', 'hod', 'faculty', 'student']), getNotices);

router.use(requireRole(['principal']));
router.use(tenantIsolation);

// Stats
router.get('/dashboard-stats', getDashboardStats);

// ERP Metadata config PUT
router.put('/config', updateCollegeConfig);

// Complete User Account CRUD
router.post('/users', createUser);
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/import', bulkImportUsers);
router.get('/users/export', bulkExportUsers);

// Departments CRUD
router.post('/departments', createDepartment);
router.get('/departments', getDepartments);
router.put('/departments/:id', updateDepartment);
router.delete('/departments/:id', deleteDepartment);

// Staff profiles management (HODs legacy mapping)
router.post('/hods', createHODAccount);
router.get('/staff', getStaffAccounts);
router.patch('/staff/:id', toggleHODAccount);
router.patch('/staff/:id/reset-password', resetHODPassword);

// Notices Board
router.post('/notices', publishNotice);

// Calendar Schedules
router.post('/calendar', createCalendarItem);
router.get('/calendar', getCalendarItems);

// Student Master Academic Records CRUD
router.post('/student-records', createStudentRecord);
router.get('/student-records', getStudentRecords);
router.put('/student-records/:id', updateStudentRecord);
router.delete('/student-records/:id', deleteStudentRecord);
router.post('/student-records/import', bulkImportStudentRecords);
router.post('/student-records/bulk-action', bulkActionStudentRecords);
router.get('/student-records/export', bulkExportStudentRecords);

// Approvals & Workflows Routing
router.get('/approvals', getApprovalsQueue);
router.post('/approvals/create', createApprovalRequest);
router.get('/approvals/history', getWorkflowHistory);
router.post('/approvals/:type/:id', actionApproval);
router.get('/timetables/pending', getTimetablesQueue);
router.post('/timetables/:id/approve', actionTimetableApproval);

// Enterprise ERP Master Import Routes
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post('/erp-master/parse-pdf', upload.single('file'), parseErpMasterPdf);
router.post('/erp-master/confirm', confirmErpMasterImport);

// Logs
router.get('/audit-logs', getCampusActivityLogs);

module.exports = router;
