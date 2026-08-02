const express = require('express');
const router = express.Router();
const { campusLogin, verifyFacultyFace, refreshAccessToken, registerPrincipal, forceChangePassword } = require('../controllers/campusAuthController');

router.post('/login/:portalType', campusLogin);
router.post('/register-principal', registerPrincipal);
router.post('/verify-face', verifyFacultyFace);
router.post('/refresh', refreshAccessToken);
router.post('/force-change-password', forceChangePassword);

// Fallback login support for backwards compatibility
router.post('/login', (req, res, next) => {
  req.params.portalType = req.body.role || 'faculty';
  next();
}, campusLogin);

module.exports = router;
