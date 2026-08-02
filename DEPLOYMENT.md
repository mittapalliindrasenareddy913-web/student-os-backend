# Campus OS Backend — Deployment Guide

> **Architecture**: Node.js 20 + Express 5 + MongoDB Atlas + Socket.IO + Cloudflare R2  
> **Minimum RAM**: 512 MB | **Recommended**: 1 GB+  
> **Node version**: 20.x LTS

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Setup](#2-environment-setup)
3. [Option A — PM2 (VPS/Bare Metal)](#3-option-a--pm2-vpsbm)
4. [Option B — Docker](#4-option-b--docker)
5. [Option C — Railway / Render](#5-option-c--railway--render)
6. [MongoDB Setup](#6-mongodb-setup)
7. [Nginx Reverse Proxy](#7-nginx-reverse-proxy)
8. [Health Monitoring](#8-health-monitoring)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

- Node.js 20.x LTS
- npm 10+
- MongoDB Atlas cluster (or self-hosted MongoDB 7+)
- Cloudflare R2 bucket (for file storage)
- Firebase project (for push notifications)
- Resend account (for email delivery)

---

## 2. Environment Setup

```bash
# Clone and install
git clone <repo-url>
cd student-os-backend-main
npm ci --only=production

# Configure environment
cp .env.example .env
nano .env  # fill in all secrets
```

> [!IMPORTANT]
> **Never commit `.env` to version control.** It contains private keys.  
> All secrets must be rotated if accidentally exposed.

### Critical Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | Minimum 32 random characters |
| `JWT_REFRESH_SECRET` | ✅ | Minimum 32 random characters |
| `NODE_ENV` | ✅ | Set to `production` |
| `RESEND_API_KEY` | ✅ | Email delivery |
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | FCM push notifications |
| `R2_*` | ✅ | File storage |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated frontend URLs |
| `GEMINI_API_KEY` | Optional | AI features |

---

## 3. Option A — PM2 (VPS/BM)

```bash
# Install PM2 globally
npm install -g pm2

# Start in cluster mode (uses all CPU cores)
pm2 start ecosystem.config.js --env production

# Save process list for auto-restart on reboot
pm2 save
pm2 startup

# Monitor
pm2 monit

# View logs
pm2 logs campus-os-backend

# Reload with zero downtime (after code update)
pm2 reload campus-os-backend
```

### PM2 ecosystem.config.js

The existing `ecosystem.config.js` runs in cluster mode (`instances: 'max'`).

> [!NOTE]
> Socket.IO in cluster mode requires a Redis adapter for cross-process pub/sub.  
> For single-server deployments, set `instances: 1` to avoid socket sync issues.

---

## 4. Option B — Docker

```bash
# Build image
docker build -t campus-os-backend:latest .

# Run container
docker run -d \
  --name campus-os \
  -p 5000:5000 \
  --env-file .env \
  --restart unless-stopped \
  campus-os-backend:latest

# View logs
docker logs -f campus-os

# Health check
docker inspect --format='{{.State.Health.Status}}' campus-os
```

### Docker Compose

```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "5000:5000"
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 5. Option C — Railway / Render

1. Connect your GitHub repository.
2. Set all environment variables from `.env.example` in the platform's secrets dashboard.
3. Set the start command: `node index.js`
4. Set Node.js version to **20**.
5. Add health check path: `/api/health`

---

## 6. MongoDB Setup

### Atlas Configuration

1. Create a cluster (M10+ for production).
2. Whitelist your server's IP address (or `0.0.0.0/0` for dynamic IPs).
3. Create a database user with `readWrite` on `student-os`.
4. Enable Atlas Search if you need full-text search.

### Recommended Indexes

Run these in the MongoDB shell or Atlas UI:

```js
// User lookups
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ collegeCode: 1, role: 1 });
db.users.createIndex({ rollNumber: 1, collegeCode: 1 });

// Attendance hot queries
db.attendances.createIndex({ studentId: 1, subject: 1, date: -1 });
db.attendances.createIndex({ facultyId: 1, date: -1 });

// Audit log queries
db.auditlogs.createIndex({ collegeCode: 1, createdAt: -1 });
db.auditlogs.createIndex({ actorId: 1, createdAt: -1 });

// Exam results
db.examresults.createIndex({ studentId: 1, semester: 1, collegeCode: 1 });

// Notifications
db.notifications.createIndex({ userId: 1, isRead: 1, createdAt: -1 });

// Community posts
db.posts.createIndex({ collegeCode: 1, createdAt: -1 });
db.posts.createIndex({ authorId: 1, createdAt: -1 });

// TTL: Auto-expire OTP records after 15 minutes
db.otps.createIndex({ createdAt: 1 }, { expireAfterSeconds: 900 });
```

---

## 7. Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    # Security headers (complement helmet.js)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY;

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        client_max_body_size 15m;
    }
}
```

---

## 8. Health Monitoring

### Health Check Endpoint

```
GET /api/health
→ 200 { "status": "OK", "service": "Student OS Backend" }
```

### Uptime Robot / Betterstack

Monitor: `https://api.your-domain.com/api/health`  
Alert threshold: 2 consecutive failures → notify team.

### Log Files (Production)

| File | Description |
|------|-------------|
| `logs/error.log` | Error-level events |
| `logs/combined.log` | All log levels |

Rotate logs with `logrotate` or use a log shipping service (Logtail, Datadog).

---

## 9. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `MongoDB connection failed` | Bad `MONGO_URI` or IP not whitelisted | Check Atlas Network Access |
| `CORS policy violation` | Origin not in `ALLOWED_ORIGINS` | Add origin to env var |
| `TokenExpiredError` | JWT expired | Client should refresh using `/api/auth/refresh` |
| `429 Too Many Requests` | Rate limit hit | Implement retry-after logic on client |
| `EADDRINUSE` | Port 5000 in use | `lsof -i :5000` then kill process |
| Socket.IO not connecting | Nginx missing WebSocket headers | Add `Upgrade` and `Connection` headers (see §7) |

---

## Security Checklist Before Go-Live

- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are 32+ random characters
- [ ] `NODE_ENV=production` is set
- [ ] `ALLOWED_ORIGINS` is configured with your domain(s)
- [ ] `.env` is in `.gitignore`
- [ ] MongoDB user has minimum required permissions
- [ ] Atlas IP whitelist is restricted to server IP
- [ ] HTTPS is enabled (SSL certificate installed)
- [ ] Nginx `client_max_body_size` matches Express `10mb` limit
- [ ] PM2 or Docker restart policy is configured
- [ ] Health check monitoring is active
