/**
 * Permission Enforcement Middleware
 */
const { hasPermission } = require('../permissions/permissionService');
const { securityLogger } = require('../logging/logger');

const checkPermission = (action) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access',
        error: { code: 'UNAUTHORIZED', details: [] }
      });
    }

    const role = user.role;
    if (!hasPermission(role, action)) {
      securityLogger.warn('Unauthorized action attempt', {
        action,
        userId: user._id,
        role,
        collegeCode: user.collegeCode,
        ip: req.ip,
        reqId: req.reqId
      });

      return res.status(403).json({
        success: false,
        message: 'Access Denied — Insufficient Permissions.',
        error: {
          code: 'FORBIDDEN',
          details: [{ message: `Role '${role}' does not have permission to perform '${action}'.` }]
        }
      });
    }

    next();
  };
};

module.exports = checkPermission;
