const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized. User session missing.' });
    }
    
    // Check if user is active
    if (req.user.isActive === false) {
      return res.status(403).json({ message: 'Access denied. Account is disabled.' });
    }

    const userRole = (req.user.role || '').toLowerCase();
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());

    // Allow both superadmin and super_admin variants
    if (normalizedAllowed.includes('superadmin') || normalizedAllowed.includes('super_admin')) {
      if (!normalizedAllowed.includes('superadmin')) normalizedAllowed.push('superadmin');
      if (!normalizedAllowed.includes('super_admin')) normalizedAllowed.push('super_admin');
    }

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({ message: 'Access forbidden. Insufficient permissions.' });
    }

    next();
  };
};

module.exports = requireRole;
