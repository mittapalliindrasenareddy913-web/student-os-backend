const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized. User session missing.' });
    }
    
    // Check if user is active
    if (req.user.isActive === false) {
      return res.status(403).json({ message: 'Access denied. Account is disabled.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access forbidden. Insufficient permissions.' });
    }

    next();
  };
};

module.exports = requireRole;
