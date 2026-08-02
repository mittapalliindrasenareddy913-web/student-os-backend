const User = require('../models/User');
const { createNotification } = require('../controllers/notificationController');
const { sendFcmNotification } = require('../services/notificationService');

/**
 * Enterprise Event-driven Synchronization Engine.
 * Saves to MongoDB, dispatches FCM alerts, and multicasts Socket.io frames instantly.
 */
const syncUpdate = async (io, collegeCode, { title, body, type, payload, targetUserIds = [], filters = {} }) => {
  try {
    const code = collegeCode.toUpperCase();
    console.log(`🔄 [SyncEngine] Syncing: "${title}" | Type: ${type} | College: ${code}`);

    // If specific target users are provided
    if (targetUserIds && targetUserIds.length > 0) {
      for (const uid of targetUserIds) {
        // 1. Create DB notification and emit Socket.io frame
        await createNotification(io, uid, {
          title,
          message: body,
          type,
          priority: 'high'
        });

        // 2. Emit specific Socket.IO sync packet for offline/local cache updates
        if (io) {
          io.to(uid.toString()).emit('sync_update', { type, payload });
        }
      }
    } else {
      // Broadcast/Multicast matching criteria
      const query = { role: 'student', collegeCode: code, isActive: true };
      if (filters.department) query.assignedDepartment = filters.department;
      if (filters.year) query.year = Number(filters.year);
      if (filters.section) query.branch = filters.section;

      const students = await User.find(query).select('_id');
      for (const s of students) {
        await createNotification(io, s._id, {
          title,
          message: body,
          type,
          priority: 'high'
        });
      }

      // Socket.io multicast to room
      if (io) {
        io.to(code).emit('sync_update', { type, payload });
      }

      // FCM Multicast
      await sendFcmNotification({
        collegeCode: code,
        department: filters.department,
        year: filters.year,
        section: filters.section,
        title,
        body
      });
    }

    return { success: true };
  } catch (err) {
    console.error('❌ [SyncEngine] Sync execution failed:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { syncUpdate };
