const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { getParentDashboard, applyParentLeave } = require('../controllers/parentController');

router.use(protect);
router.use(requireRole(['parent']));

router.get('/dashboard', getParentDashboard);
router.post('/leave', applyParentLeave);

module.exports = router;
