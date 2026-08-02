const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getFriends,
  searchFriendByMobile,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getGroups,
  createGroup,
  joinGroup,
  getMessages
} = require('../controllers/communityController');

router.use(protect);

// Friends
router.get('/friends', getFriends);
router.post('/friends/search', searchFriendByMobile);
router.post('/friends/request', sendFriendRequest);
router.put('/friends/accept/:id', acceptFriendRequest);
router.put('/friends/reject/:id', rejectFriendRequest);

// Groups
router.get('/groups', getGroups);
router.post('/groups', createGroup);
router.post('/groups/join/:inviteCode', joinGroup);

// Chat
router.get('/chat/:recipientId', getMessages);

module.exports = router;
