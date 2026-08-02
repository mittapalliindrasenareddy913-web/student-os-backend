const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const User = require('../models/User');
const Note = require('../models/Note');

// ── 1. Android Asset Links ──────────────────────────────────────────────────
router.get('/.well-known/assetlinks.json', (req, res) => {
  res.json([
    {
      "relation": ["delegate_permission/common.handle_all_urls"],
      "target": {
        "namespace": "android_app",
        "package_name": "app.studentos.productivity",
        "sha256_cert_fingerprints": [
          "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5"
        ]
      }
    }
  ]);
});

// ── Helper: Render Beautiful Fallback Page ──────────────────────────────────
const renderLandingPage = ({ title, subtitle, description, meta, openUrl, playStoreUrl }) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} | Student OS</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          background: #0b0d19;
          color: #f3f4f6;
          font-family: 'Outfit', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow-x: hidden;
        }
        .container {
          width: 100%;
          max-width: 440px;
          background: rgba(30, 33, 43, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 35px 30px;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 
                      0 0 40px rgba(124, 58, 237, 0.08);
          animation: floatIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .logo-area {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 70px;
          height: 70px;
          border-radius: 20px;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          box-shadow: 0 10px 25px rgba(124, 58, 237, 0.35);
          margin-bottom: 25px;
          animation: pulseGlow 3s infinite alternate;
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 10px 25px rgba(124, 58, 237, 0.35); }
          100% { box-shadow: 0 10px 35px rgba(124, 58, 237, 0.55), 0 0 15px rgba(79, 70, 229, 0.3); }
        }
        .logo-area svg {
          width: 32px;
          height: 32px;
          fill: #fff;
        }
        h1 {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin-bottom: 8px;
          background: linear-gradient(to right, #a78bfa, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subtitle {
          font-size: 13px;
          font-weight: 600;
          color: #a78bfa;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 20px;
        }
        .desc-box {
          font-size: 15px;
          line-height: 1.6;
          color: #9ca3af;
          margin-bottom: 25px;
          background: rgba(11, 13, 25, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 16px;
          padding: 18px;
        }
        .meta-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          margin-bottom: 30px;
        }
        .tag {
          font-size: 11px;
          font-weight: 700;
          color: #f3f4f6;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 6px 14px;
          text-transform: uppercase;
        }
        .btn {
          display: block;
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
          text-align: center;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .btn-primary {
          background: linear-gradient(to right, #7c3aed, #4f46e5);
          color: #fff;
          border: none;
          box-shadow: 0 6px 20px rgba(124, 58, 237, 0.2);
          margin-bottom: 12px;
        }
        .btn-primary:hover {
          opacity: 0.95;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(124, 58, 237, 0.35);
        }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.03);
          color: #d1d5db;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.07);
          color: #fff;
          transform: translateY(-1px);
        }
        .playstore-hint {
          font-size: 11px;
          color: #6b7280;
          margin-top: 25px;
          line-height: 1.4;
        }
      </style>
      <script>
        // Try to automatically open in-app if scheme works, fallback to page load
        window.onload = function() {
          setTimeout(function() {
            window.location = "${openUrl}";
          }, 500);
        };
      </script>
    </head>
    <body>
      <div class="container">
        <div class="logo-area">
          <!-- Sparkles Icon -->
          <svg viewBox="0 0 24 24">
            <path d="M9 12.27L11.12 14.39L16.29 9.22L17.71 10.64L11.12 17.22L7.59 13.69L9 12.27M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2M12 20C7.58 20 4 16.42 4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20Z" />
          </svg>
        </div>
        
        <h1>${title}</h1>
        <div class="subtitle">${subtitle}</div>
        
        <div class="desc-box">
          ${description}
        </div>
        
        <div class="meta-tags">
          ${meta.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
        
        <a href="${openUrl}" class="btn btn-primary">Open App</a>
        <a href="${playStoreUrl}" class="btn btn-secondary">Install App</a>
        
        <div class="playstore-hint">
          Install Student OS to collaborate, chat, study, and join this section natively.
        </div>
      </div>
    </body>
    </html>
  `;
};

// ── 2. Group Invite Fallback Page ───────────────────────────────────────────
router.get('/group/:inviteCode', async (req, res) => {
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=app.studentos.productivity';
  const openUrl = `studentos://group/${req.params.inviteCode}`;
  
  try {
    const group = await Group.findOne({ inviteCode: req.params.inviteCode });
    if (!group) {
      return res.status(404).send(renderLandingPage({
        title: 'Group Not Found',
        subtitle: 'Invalid Invitation',
        description: 'The group invite link you followed is invalid, or the group has been deleted.',
        meta: ['Error', '404'],
        openUrl: 'studentos://community',
        playStoreUrl
      }));
    }
    
    res.send(renderLandingPage({
      title: group.name,
      subtitle: 'Group Invitation',
      description: group.description || 'Join this study & productivity collaboration group on Student OS.',
      meta: [`Semester ${group.semester || 1}`, `${group.members.length} Members`, group.type],
      openUrl,
      playStoreUrl
    }));
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// ── 3. Chat Deep Link Fallback Page ──────────────────────────────────────────
router.get('/chat/:recipientId', async (req, res) => {
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=app.studentos.productivity';
  const openUrl = `studentos://chat/${req.params.recipientId}`;
  
  try {
    const user = await User.findById(req.params.recipientId);
    if (!user) {
      return res.status(404).send(renderLandingPage({
        title: 'User Not Found',
        subtitle: 'Private Chat Link',
        description: 'The private chat profile link is invalid or has been disabled.',
        meta: ['Error', '404'],
        openUrl: 'studentos://community',
        playStoreUrl
      }));
    }
    
    res.send(renderLandingPage({
      title: user.fullName,
      subtitle: 'Direct Message Invite',
      description: `Start a direct secure private message and voice call with ${user.fullName} on Student OS.`,
      meta: ['Private Chat', 'Secure Connection'],
      openUrl,
      playStoreUrl
    }));
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// ── 4. Shared Note Fallback Page ────────────────────────────────────────────
router.get('/notes/:noteId', async (req, res) => {
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=app.studentos.productivity';
  const openUrl = `studentos://notes/${req.params.noteId}`;
  
  try {
    const note = await Note.findById(req.params.noteId).populate('user', 'fullName');
    if (!note) {
      return res.status(404).send(renderLandingPage({
        title: 'Note Not Found',
        subtitle: 'Shared Study Note',
        description: 'The shared study material note you requested is no longer available.',
        meta: ['Error', '404'],
        openUrl: 'studentos://notes',
        playStoreUrl
      }));
    }
    
    res.send(renderLandingPage({
      title: note.title,
      subtitle: 'Shared Document',
      description: `View and study the shared notes document "${note.title}" created by ${note.user?.fullName || 'a Student OS user'}.`,
      meta: ['Study Note', 'Shared Resource'],
      openUrl,
      playStoreUrl
    }));
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// ── 5. Shared PDF Fallback Page ─────────────────────────────────────────────
router.get('/pdf/:pdfId', (req, res) => {
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=app.studentos.productivity';
  const openUrl = `studentos://pdf/${req.params.pdfId}`;
  
  res.send(renderLandingPage({
    title: 'Shared PDF Document',
    subtitle: 'PDF Hub Resource',
    description: 'A study PDF document has been shared with you. Install or open Student OS to view, highlight, annotate, or export.',
    meta: ['PDF Document', 'Shared Resource'],
    openUrl,
    playStoreUrl
  }));
});

// ── 6. Profile Invite Fallback Page ─────────────────────────────────────────
router.get('/invite/:inviteCode', (req, res) => {
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=app.studentos.productivity';
  const openUrl = `studentos://invite/${req.params.inviteCode}`;
  
  res.send(renderLandingPage({
    title: 'Friend Connection',
    subtitle: 'App Invite Code',
    description: 'Add a new friend connection and start collaborating on Student OS. Tap Open App to connect.',
    meta: ['Friend Connection', 'Invite'],
    openUrl,
    playStoreUrl
  }));
});

module.exports = router;
