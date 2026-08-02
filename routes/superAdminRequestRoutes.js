const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const {
  getSaaSStats,
  addMasterCollege,
  getAllColleges,
  updateCollege,
  deleteCollege,
  toggleCollegeStatus,
  createSubscriptionPlan,
  getSubscriptionPlans,
  createCollegeSubscription,
  getInvoices,
  getAllPlatformUsers,
  resetUserPassword,
  toggleUserAccount,
  assignUserRole,
  approveRequest,
  rejectRequest,
  getSystemConfig,
  saveSystemConfig,
  broadcastNotification,
  getStorageQuotaDetails,
  updateStorageQuota,
  getIntegrations,
  updateIntegrations,
  getSecurityMetrics,
  searchAuditLogs,
  triggerBackup,
  getBackupHistory,
  getSupportTickets,
  resolveSupportTicket,
  updateCollegeFeatures,
  toggleMaintenanceMode,
  updateProfile,
  getLeads,
  updateLeadStatus,
  registerFullCollege
} = require('../controllers/superAdminRequestController');

router.use(protect);
router.use(requireRole(['super_admin']));

// Stats & SaaS analytics
router.get('/stats', getSaaSStats);

// Onboarding requests
router.post('/:requestId/approve', approveRequest);
router.post('/:requestId/reject', rejectRequest);

// College Management CRUD
router.post('/colleges', addMasterCollege);
router.post('/colleges/register-full', registerFullCollege);
router.get('/colleges', getAllColleges);
router.put('/colleges/:id', updateCollege);
router.delete('/colleges/:id', deleteCollege);
router.post('/colleges/:code/suspend', toggleCollegeStatus);

// Subscriptions & SaaS Billing
router.post('/plans', createSubscriptionPlan);
router.get('/plans', getSubscriptionPlans);
router.post('/subscriptions', createCollegeSubscription);
router.get('/invoices', getInvoices);

// User & Role Management
router.get('/users', getAllPlatformUsers);
router.post('/users/:id/reset-password', resetUserPassword);
router.post('/users/:id/toggle-status', toggleUserAccount);
router.post('/users/:id/role', assignUserRole);

// System Configuration
router.get('/config', getSystemConfig);
router.post('/config', saveSystemConfig);

// Global Broadcasts
router.post('/broadcast', broadcastNotification);

// Storage Management
router.get('/storage', getStorageQuotaDetails);
router.post('/storage/quota', updateStorageQuota);

// Integrations Settings
router.get('/integrations', getIntegrations);
router.post('/integrations', updateIntegrations);

// Security Center
router.get('/security', getSecurityMetrics);

// Advanced Audit Search
router.get('/audit-logs', searchAuditLogs);

// Backups & DR
router.post('/backup', triggerBackup);
router.get('/backup', getBackupHistory);

// Support Desk
router.get('/support/tickets', getSupportTickets);
router.post('/support/tickets/:id/resolve', resolveSupportTicket);

// Feature Toggles Rollouts
router.post('/colleges/:code/features', updateCollegeFeatures);

// Maintenance Mode
router.post('/maintenance/toggle', toggleMaintenanceMode);

// Profile
router.put('/profile', updateProfile);

// Leads
router.get('/leads', getLeads);
router.put('/leads/:id/status', updateLeadStatus);

module.exports = router;
