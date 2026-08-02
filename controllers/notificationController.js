const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/firebase');

// ── Internal helper: create + push ───────────────────────────────────────
const createNotification = async (io, userId, {
  title, message, type = 'system', link = '',
  senderId = null, senderName = '', senderAvatar = '', relatedId = '',
  priority = 'medium'
}) => {
  try {
    const notif = await Notification.create({
      user: userId, title, message, type, link,
      senderId, senderName, senderAvatar, relatedId,
      priority
    });

    // Real-time: emit to user's personal socket room
    if (io) {
      io.to(userId.toString()).emit('new_notification', notif);
    }

    // Push Notification via FCM (background/offline)
    const targetUser = await User.findById(userId).select('fcmTokens');
    if (targetUser?.fcmTokens?.length > 0) {
      await sendPushNotification(
        targetUser.fcmTokens,
        title,
        message,
        { type, relatedId: relatedId || '', link: link || '', notifId: notif._id.toString(), priority }
      );
    }

    return notif;
  } catch (err) {
    console.error('[Notification] create error:', err.message);
    return null;
  }
};

// ── GET /api/notifications ────────────────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const unread = await Notification.countDocuments({ user: req.user._id, isRead: false });

    res.json({ notifications, unread, page });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

// ── PUT /api/notifications/read-all ──────────────────────────────────────
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /api/notifications/:id/read ──────────────────────────────────────
const markOneRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true }
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── DELETE /api/notifications/:id ────────────────────────────────────────
const deleteNotification = async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── DELETE /api/notifications ─────────────────────────────────────────────
const clearAll = async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/notifications/unread-count ───────────────────────────────────
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ count: 0 });
  }
};

// ── PUT /api/notifications/:id/archive ────────────────────────────────────
const archiveNotification = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isArchived: true }
    );
    res.json({ message: 'Notification archived successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  markAllRead,
  markOneRead,
  deleteNotification,
  clearAll,
  getUnreadCount,
  archiveNotification
};
