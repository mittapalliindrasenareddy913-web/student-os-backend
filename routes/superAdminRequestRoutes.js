const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const {
  getSaaSStats,
  registerFullCollege,
  addMasterCollege,
  getAllColleges,
  getCollegeDetails,
  updateCollege,
  deleteCollege,
  toggleCollegeStatus,
  getAllPlatformUsers,
  resetUserPassword,
  toggleUserAccount,
  deleteUserAccount,
  approveRequest,
  rejectRequest,
  getSupportTickets,
  createSupportTicket,
  replySupportTicket,
  resolveSupportTicket,
  getLeads,
  createLead,
  updateLeadStatus,
  addLeadNote,
  deleteLead,
  createSubscriptionPlan,
  getSubscriptionPlans,
  getInvoices,
  searchAuditLogs,
  updateProfile,
  broadcastNotification
} = require('../controllers/superAdminRequestController');

router.use(protect);
router.use(requireRole(['super_admin']));

// Live Dashboard Stats
router.get('/stats', getSaaSStats);

// Onboarding requests approval
router.post('/:requestId/approve', approveRequest);
router.post('/:requestId/reject', rejectRequest);

// College Management CRUD & Details
router.post('/colleges/register-full', registerFullCollege);
router.post('/colleges', addMasterCollege);
router.get('/colleges', getAllColleges);
router.get('/colleges/details/:code', getCollegeDetails);
router.put('/colleges/:id', updateCollege);
router.delete('/colleges/:id', deleteCollege);
router.post('/colleges/:code/suspend', toggleCollegeStatus);

// Subscriptions & SaaS Billing
router.post('/plans', createSubscriptionPlan);
router.get('/plans', getSubscriptionPlans);
router.get('/invoices', getInvoices);

// User & Role Management
router.get('/users', getAllPlatformUsers);
router.post('/users/:id/reset-password', resetUserPassword);
router.post('/users/:id/toggle-status', toggleUserAccount);
router.delete('/users/:id', deleteUserAccount);

// Support Desk
router.get('/support/tickets', getSupportTickets);
router.post('/support/tickets', createSupportTicket);
router.post('/support/tickets/:id/reply', replySupportTicket);
router.post('/support/tickets/:id/resolve', resolveSupportTicket);

// Onboarding Leads
router.get('/leads', getLeads);
router.post('/leads', createLead);
router.put('/leads/:id/status', updateLeadStatus);
router.post('/leads/:id/notes', addLeadNote);
router.delete('/leads/:id', deleteLead);

// Audit Logs & Notifications
router.get('/audit-logs', searchAuditLogs);
router.post('/broadcast', broadcastNotification);
router.put('/profile', updateProfile);

module.exports = router;
