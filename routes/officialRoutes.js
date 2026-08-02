const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const tenantIsolation = require('../middleware/tenantIsolation');
const {
  getOfficialChats,
  getOfficialMessages,
  sendOfficialMessage,
  createOfficialGroup,
  sendBroadcast
} = require('../controllers/officialController');

router.use(protect);
router.use(tenantIsolation);

// Chat threads inside the same college
router.get('/chats', getOfficialChats);
router.get('/chat/:recipientId', getOfficialMessages);
router.post('/message', sendOfficialMessage);

// Official group and broadcast commands
router.post('/groups', createOfficialGroup);
router.post('/broadcast', sendBroadcast);

module.exports = router;
