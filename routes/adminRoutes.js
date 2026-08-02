const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const tenantIsolation = require('../middleware/tenantIsolation');
const {
  getDashboardStats,
  saveFeeLedger,
  getFeeLedgers,
  saveBusRoute,
  getBusRoutes,
  saveHostelAllocation,
  getHostelAllocations,
  saveInventoryItem,
  getInventoryItems
} = require('../controllers/adminController');

router.use(protect);
router.use(requireRole(['accounts', 'library', 'placement', 'hostel', 'transport', 'hr', 'admission_office', 'admin', 'super_admin'])); // Enforce Admin roles
router.use(tenantIsolation);

// Stats
router.get('/dashboard-stats', getDashboardStats);

// Accounts Fees
router.post('/fees', saveFeeLedger);
router.get('/fees', getFeeLedgers);

// Bus Transport Route mapping
router.post('/transport/routes', saveBusRoute);
router.get('/transport/routes', getBusRoutes);

// Hostel Rooms
router.post('/hostel/allocations', saveHostelAllocation);
router.get('/hostel/allocations', getHostelAllocations);

// Inventory Assets
router.post('/inventory', saveInventoryItem);
router.get('/inventory', getInventoryItems);

module.exports = router;
