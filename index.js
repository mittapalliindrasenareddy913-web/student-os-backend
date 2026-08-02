require('dotenv').config();
const dns      = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Force Google DNS for Atlas SRV lookups
const express       = require('express');
const mongoose      = require('mongoose');
const cors          = require('cors');
const compression   = require('compression');
const helmet        = require('helmet');
const http          = require('http');
const rateLimit     = require('express-rate-limit');
const hpp           = require('hpp');
const logger        = require('./services/logger');

// Custom in-place NoSQL sanitization helper for Express 5 compatibility
const cleanObj = (obj) => {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else {
        cleanObj(obj[key]);
      }
    }
  }
};

const customMongoSanitize = (req, res, next) => {
  if (req.body) cleanObj(req.body);
  if (req.query) cleanObj(req.query);
  if (req.params) cleanObj(req.params);
  next();
};

const traceMiddleware = require('./shared/middleware/trace');
const configureSecurity = require('./shared/middleware/security');

const app  = express();
const server = http.createServer(app);

// Request Tracing
app.use(traceMiddleware);

// Performance monitor & database slow-query tracking
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const threshold = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '100', 10);
    
    logger.info(`HTTP ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      reqId: req.reqId,
      userId: req.user ? req.user._id : 'anonymous'
    });

    if (duration > threshold) {
      logger.warn(`Slow Request Warning: HTTP ${req.method} ${req.originalUrl} took ${duration}ms`, {
        method: req.method,
        url: req.originalUrl,
        durationMs: duration,
        reqId: req.reqId
      });
    }
  });
  next();
});

// Initialize Socket.io
const initSocket = require('./socket');
const io = initSocket(server);

// Make io accessible to controllers via app.get('io')
app.set('io', io);

app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(compression());
configureSecurity(app);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Security Sanitisers ──────────────────────────────────────────────────────
// Prevent NoSQL injection attacks (strips $ and . from user input)
app.use(customMongoSanitize);

// Prevent HTTP parameter pollution (keeps last value when duplicates exist)
app.use(hpp());

// ── MongoDB ──────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    logger.info('MongoDB connected successfully');
    const seedCategories = require('./utils/seedCategories');
    seedCategories();
    const seedMasterData = require('./utils/seedMasterData');
    seedMasterData();
  })
  .catch((err) => {
    logger.error('MongoDB connection failed', { error: err.message });
    // Keep server running so health probes still pass
  });

// ── Rate Limiting ────────────────────────────────────────────────────────────
// Auth routes: strict limiter (prevents brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again after 15 minutes.' },
  skip: (req) => req.method === 'GET',
});

// API global limiter (prevents DoS/flooding)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 300,                 // 300 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});

// ── Routes ───────────────────────────────────────────────────────────────────
// Apply global API rate limiter to all /api routes
app.use('/api', apiLimiter);

// Decoupled / Versioned Enterprise Modules API Routes
app.use('/api/v1',            require('./routes/health'));
app.use('/api/v1/community',  require('./modules/community/routes/communityRoutes'));

app.use('/',                  require('./routes/webFallbackRoutes'));
app.use('/api/auth',          authLimiter, require('./routes/authRoutes'));
app.use('/api/attendance',    require('./routes/attendanceRoutes'));
app.use('/api/tasks',         require('./routes/taskRoutes'));
app.use('/api/notes',         require('./routes/noteRoutes'));
app.use('/api/timetable',     require('./routes/timetableRoutes'));
app.use('/api/focus',         require('./routes/focusRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/ai',            require('./routes/aiRoutes'));
app.use('/api/study',         require('./routes/studyRoutes'));
app.use('/api/community',     require('./routes/communityRoutes'));
app.use('/api/bookmarks',     require('./routes/bookmarkRoutes'));
app.use('/api/pagenotes',     require('./routes/pageNoteRoutes'));
app.use('/api/favourites',    require('./routes/favouritePDFRoutes'));
app.use('/api/folders',       require('./routes/subjectFolderRoutes'));

// Campus OS Routes
app.use('/api/super-admin',   require('./routes/superAdminRoutes'));
app.use('/api/college',       require('./routes/collegeRoutes'));
app.use('/api/auth/campus',   require('./routes/campusAuthRoutes'));
app.use('/api/principal',     require('./routes/principalRoutes'));
app.use('/api/hod',           require('./routes/hodRoutes'));
app.use('/api/faculty',       require('./routes/facultyRoutes'));
app.use('/api/coe',           require('./routes/coeRoutes'));
app.use('/api/admin',         require('./routes/adminRoutes'));
app.use('/api/official',      require('./routes/officialRoutes'));
app.use('/api/erp',           require('./routes/erpRoutes'));
app.use('/api/college-requests',      require('./routes/collegeRequestRoutes'));
app.use('/api/super-admin/requests', require('./routes/superAdminRequestRoutes'));
app.use('/api/parent', require('./routes/parentRoutes'));
app.use('/api/recruiter', require('./routes/recruiterRoutes'));

app.use('/api/student', require('./routes/studentRoutes'));



// Privacy Policy (required for Google Play Store)
app.get('/privacy', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Privacy Policy – Student OS</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#1f2937;line-height:1.7}
    .container{max-width:800px;margin:0 auto;padding:40px 24px 80px}
    header{background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#fff;padding:40px 24px;text-align:center}
    header h1{font-size:2rem;font-weight:800;margin-bottom:8px}
    header p{font-size:1rem;opacity:.85}
    .card{background:#fff;border-radius:12px;padding:32px;margin-top:24px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    h2{font-size:1.15rem;font-weight:700;color:#4f46e5;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e0e7ff}
    p,li{font-size:.95rem;color:#374151;margin-bottom:8px}
    ul{padding-left:20px;margin-bottom:8px}
    a{color:#4f46e5}
    .badge{display:inline-block;background:#e0e7ff;color:#4f46e5;padding:2px 10px;border-radius:20px;font-size:.8rem;font-weight:600;margin-bottom:16px}
    footer{text-align:center;margin-top:40px;font-size:.85rem;color:#6b7280}
  </style>
</head>
<body>
<header>
  <h1>🎓 Student OS</h1>
  <p>Privacy Policy</p>
</header>
<div class="container">
  <div class="card">
    <span class="badge">Last Updated: July 2026</span>
    <p>Student OS ("we", "our", or "us") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use the Student OS mobile application and related services.</p>
  </div>

  <div class="card">
    <h2>1. Information We Collect</h2>
    <ul>
      <li><strong>Account Information:</strong> Name, email address, profile photo when you register or sign in with Google.</li>
      <li><strong>Academic Data:</strong> Timetable entries, attendance records, tasks, assignments, notes, and study materials you create.</li>
      <li><strong>Usage Data:</strong> Focus session durations, habit tracking data, expense logs, and goal progress.</li>
      <li><strong>Community Data:</strong> Posts, comments, messages, and group interactions within the app.</li>
      <li><strong>Device Information:</strong> Device type, operating system version, and app version for debugging purposes.</li>
      <li><strong>Files & Media:</strong> PDFs and images you upload for academic use, stored securely via Cloudflare R2.</li>
    </ul>
  </div>

  <div class="card">
    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>To provide and improve Student OS features and functionality.</li>
      <li>To authenticate your identity and maintain your account.</li>
      <li>To sync your academic data across devices.</li>
      <li>To send important notifications related to your schedule and tasks.</li>
      <li>To provide AI-powered study assistance features.</li>
      <li>To analyze usage patterns and improve app performance.</li>
    </ul>
  </div>

  <div class="card">
    <h2>3. Data Storage & Security</h2>
    <p>Your data is stored securely using MongoDB Atlas (cloud database) with encrypted connections. File uploads are handled by Cloudflare R2 with industry-standard security. We use JWT tokens for secure authentication. We implement rate limiting and security headers to protect against unauthorized access.</p>
  </div>

  <div class="card">
    <h2>4. Google Sign-In</h2>
    <p>Student OS supports Google Sign-In via Google OAuth 2.0. When you sign in with Google, we receive your name, email, and profile picture from Google. We do not receive or store your Google password. Your Google data is only used to create and manage your Student OS account.</p>
  </div>

  <div class="card">
    <h2>5. Data Sharing</h2>
    <p>We do <strong>not</strong> sell, trade, or rent your personal information to third parties. We may share data with:</p>
    <ul>
      <li><strong>Service Providers:</strong> MongoDB Atlas (database), Cloudflare R2 (file storage), Google (OAuth authentication), Render (hosting).</li>
      <li><strong>Legal Requirements:</strong> When required by law or to protect our legal rights.</li>
    </ul>
  </div>

  <div class="card">
    <h2>6. Community Features</h2>
    <p>Posts, comments, and profile information you share in the Community Hub are visible to other Student OS users. You can delete your posts at any time. Direct messages are only visible to the sender and recipient.</p>
  </div>

  <div class="card">
    <h2>7. Data Retention</h2>
    <p>We retain your data for as long as your account is active. You can request deletion of your account and all associated data at any time by contacting us. Upon deletion, your data will be permanently removed within 30 days.</p>
  </div>

  <div class="card">
    <h2>8. Children's Privacy</h2>
    <p>Student OS is designed for students aged 13 and above. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us immediately.</p>
  </div>

  <div class="card">
    <h2>9. Your Rights</h2>
    <ul>
      <li><strong>Access:</strong> Request a copy of your personal data.</li>
      <li><strong>Correction:</strong> Update or correct inaccurate information.</li>
      <li><strong>Deletion:</strong> Request deletion of your account and data.</li>
      <li><strong>Portability:</strong> Export your data in a readable format.</li>
    </ul>
  </div>

  <div class="card">
    <h2>10. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify you of significant changes through the app or via email. Continued use of Student OS after changes constitutes acceptance of the updated policy.</p>
  </div>

  <div class="card">
    <h2>11. Contact Us</h2>
    <p>If you have any questions about this Privacy Policy or how we handle your data, please contact us at:</p>
    <p>📧 <a href="mailto:support@studentos.app">support@studentos.app</a></p>
    <p>📦 Package: <code>com.studentos.app.edu</code></p>
  </div>

  <footer>
    <p>© 2026 Student OS. All rights reserved.</p>
    <p>This privacy policy is effective as of July 2026.</p>
  </footer>
</div>
</body>
</html>`);
});

// Health checks and status endpoints
app.get('/', (_req, res) => {
  res.json({
    status: "OK",
    service: "Student OS Backend"
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: "OK",
    service: "Student OS Backend"
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: "OK",
    service: "Student OS Backend"
  });
});

app.get('/api', (_req, res) => {
  res.json({
    message: "Student OS Backend Running"
  });
});




// 404 handler
app.use((req, res) => res.status(404).json({ message: `${req.method} ${req.originalUrl} not found.` }));

// Global error handler — never exposes stack traces to the client
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;

  // Log full error server-side
  logger.error('Unhandled server error', {
    method: req.method,
    url: req.originalUrl,
    status,
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    ip: req.ip,
    userId: req.user ? req.user._id : undefined,
  });

  // CORS error — give a friendlier message
  if (err.message && err.message.startsWith('CORS policy violation')) {
    return res.status(403).json({ message: err.message });
  }

  // In production, never reveal internals
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error.'
    : (err.message || 'Internal server error.');

  res.status(status).json({ message });
});

const os = require('os');

const getLocalIP = () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
};

server.listen(PORT, '0.0.0.0', () => {
  if (process.env.NODE_ENV === 'production') {
    logger.info(`Campus OS Production Backend running on port ${PORT}`);
  } else {
    const ip = getLocalIP();
    logger.info(`Server started`, {
      local: `http://localhost:${PORT}`,
      network: `http://${ip}:${PORT}`,
    });
    console.log(`\n🚀  Server → http://localhost:${PORT}`);
    console.log(`📱  Mobile  → http://${ip}:${PORT}`);
    console.log(`\n⚡  Update frontend/.env if IP changed:\n    VITE_BACKEND_URL=http://${ip}:${PORT}\n`);
  }
});

// Trigger Render redeployment to reset stuck in-memory locks
