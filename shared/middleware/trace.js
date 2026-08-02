/**
 * Request Tracing Middleware
 * Generates and binds X-Request-Id for trace tracking.
 */
const { v4: uuidv4 } = require('uuid');

const traceMiddleware = (req, res, next) => {
  // Check if Request ID already exists in incoming headers, else generate one
  const reqId = req.headers['x-request-id'] || uuidv4();
  
  req.reqId = reqId;
  res.setHeader('X-Request-Id', reqId);
  
  next();
};

module.exports = traceMiddleware;
