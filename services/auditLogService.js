const AuditLog = require('../models/AuditLog');

const logAction = async (userId, role, collegeCode, department, action, req, oldValues = null, newValues = null) => {
  try {
    const device = req ? req.headers['user-agent'] || 'Unknown Device' : 'System';
    const ipAddress = req ? req.ip || req.connection.remoteAddress || '127.0.0.1' : '127.0.0.1';

    await AuditLog.create({
      userId,
      role,
      collegeCode: collegeCode || '',
      department: department || '',
      action,
      device,
      ipAddress,
      oldValues,
      newValues
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
};

module.exports = { logAction };

