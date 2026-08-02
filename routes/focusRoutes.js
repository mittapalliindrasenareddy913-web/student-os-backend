const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getSessions, startSession, completeSession } = require('../controllers/focusController');

router.use(protect);
router.get('/',               getSessions);
router.post('/',              startSession);
router.put('/:id/complete',   completeSession);

module.exports = router;
