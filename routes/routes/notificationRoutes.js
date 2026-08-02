const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getNotifications, markAllRead, markRead, deleteNotif } = require('../controllers/notificationController');

router.use(protect);
router.get('/',              getNotifications);
router.put('/read-all',      markAllRead);
router.put('/:id/read',      markRead);
router.delete('/:id',        deleteNotif);

module.exports = router;
