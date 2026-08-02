const logger = require('../services/logger');

/**
 * tenantMiddleware — Enforces tenant data boundary isolation.
 * For non-Super Admin users, attaches `req.tenantCollegeCode = req.user.collegeCode`.
 * Rejects any request attempting to query or mutate another college's resources.
 * Super Admin users bypass tenant scope filters or can specify a target college header.
 */
const enforceTenantIsolation = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required for tenant verification.' });
  }

  // Super admin can access cross-tenant or override via header/query
  if (req.user.role === 'super_admin') {
    const targetHeader = req.headers['x-tenant-college-code'] || req.query.collegeCode;
    req.tenantCollegeCode = targetHeader ? targetHeader.toUpperCase() : null;
    return next();
  }

  // Normal users are strictly locked to their assigned college code
  if (!req.user.collegeCode) {
    return res.status(403).json({ message: 'Access denied — User has no assigned college tenant.' });
  }

  const userCollege = req.user.collegeCode.toUpperCase();
  const requestedCollege = (req.params.collegeCode || req.body.collegeCode || req.query.collegeCode || '').toUpperCase();

  if (requestedCollege && requestedCollege !== userCollege) {
    logger.warn('Multi-tenant violation blocked:', {
      userId: req.user._id,
      userCollege,
      requestedCollege,
      path: req.originalUrl
    });
    return res.status(403).json({ message: 'Access denied — Multi-tenant data boundary violation.' });
  }

  req.tenantCollegeCode = userCollege;
  next();
};

module.exports = { enforceTenantIsolation };
