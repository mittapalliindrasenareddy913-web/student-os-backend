const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const logger = require('../services/logger');

/**
 * protect — validates JWT, ensures user exists and is active.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized — no token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password -refreshTokens');

    if (!user) {
      logger.warn('Auth failure: token references non-existent user', { userId: decoded.id, ip: req.ip });
      return res.status(401).json({ message: 'Not authorized — account not found.' });
    }

    if (user.isActive === false) {
      logger.warn('Auth failure: disabled account attempted access', { userId: user._id, email: user.email, ip: req.ip });
      return res.status(403).json({ message: 'Access denied — account is disabled. Contact administrator.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Not authorized — session expired. Please log in again.' });
    }
    logger.warn('Auth failure: invalid token', { error: err.message, ip: req.ip });
    return res.status(401).json({ message: 'Not authorized — token invalid.' });
  }
};

module.exports = { protect };
