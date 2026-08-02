/**
 * Security Headers configuration utilizing Helmet, HSTS, CORS rules.
 */
const helmet = require('helmet');
const cors = require('cors');
const config = require('../config/environment');

const configureSecurity = (app) => {
  // CORS Configuration - Allow all origins to support hosting on Netlify/Vercel
  app.use(cors({
    origin: (origin, callback) => {
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'bypass-tunnel-reminder', 'ngrok-skip-browser-warning']
  }));

  // Helmet Configurations
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", config.r2.publicUrl, "https://lh3.googleusercontent.com"],
        connectSrc: ["'self'", "wss:", "https:"],
        frameAncestors: ["'none'"]
      }
    },
    frameguard: { action: 'deny' }, // Frame Guard: prevent clickjacking
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true, // X-Content-Type-Options: nosniff
    xssFilter: true, // Legacy X-XSS-Protection header
    dnsPrefetchControl: { allow: false }
  }));
};

module.exports = configureSecurity;
