const User = require('../models/User');
const { sendPushNotification } = require('../utils/firebase');

/**
 * Sends a real-time push notification using FCM to all student devices
 * matching the specific college, department, year, and section.
 */
const sendFcmNotification = async ({ collegeCode, department, year, section, title, body }) => {
  try {
    const filters = {
      role: 'student',
      collegeCode: collegeCode.toUpperCase(),
      isActive: true
    };

    if (department) filters.assignedDepartment = department.toUpperCase();
    if (year) filters.year = Number(year);
    if (section) filters.branch = section.toUpperCase(); // using branch/section mappings

    // Query active tokens
    const students = await User.find(filters).select('fcmTokens fullName');
    const allTokens = [];
    students.forEach(s => {
      if (s.fcmTokens && s.fcmTokens.length > 0) {
        allTokens.push(...s.fcmTokens);
      }
    });

    console.log(`📡 [FCM Notification Service] Title: "${title}" | Target: ${students.length} students | Tokens: ${allTokens.length}`);

    if (allTokens.length === 0) {
      return { success: true, sentCount: 0, message: 'No active device tokens found for target criteria.' };
    }

    // Send push notification via Firebase Admin SDK helper
    await sendPushNotification(allTokens, title, body);
    
    return {
      success: true,
      sentCount: allTokens.length,
      targetStudentsCount: students.length
    };
  } catch (err) {
    console.error('FCM Notification dispatch error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendFcmNotification };
