const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAllRead,
  markOneRead,
  deleteNotification,
  clearAll,
  getUnreadCount,
  archiveNotification,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/',              getNotifications);
router.get('/unread-count',  getUnreadCount);
router.put('/read-all',      markAllRead);
router.put('/:id/read',      markOneRead);
router.put('/:id/archive',   archiveNotification);
router.delete('/clear-all',  clearAll);
router.delete('/:id',        deleteNotification);

module.exports = router;
