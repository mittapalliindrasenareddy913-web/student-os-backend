const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getFriends,
  searchFriendByMobile,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  joinGroup,
  getGroupPreview,
  getChats,
  getMessages,
  getCalls,
  blockUser,
  reportUser,
  getStories,
  createStory,
  viewStory,
  getStoryViewers,
  deleteStory,
  getDiscoverSuggestions
} = require('../controllers/communityController');

const {
  getGroups,
  createGroup,
  editGroup,
  deleteGroup,
  addMembers,
  removeMember,
  leaveGroup,
  transferOwnership,
  toggleMute,
  togglePin,
  searchMessages,
  getGroupMembers,
  markMessagesSeen,
  getGroupCategories,
  createGroupCategory,
  discoverGroups
} = require('../controllers/groupController');

const {
  getPosts,
  createPost,
  editPost,
  deletePost,
  likePost,
  getComments,
  addComment,
  editComment,
  deleteComment,
  savePost,
  getSavedPosts,
  reportPost,
  followUser,
  unfollowUser,
  getProfileStats,
  getUserProfileById
} = require('../controllers/postController');

// Public preview route
router.get('/groups/preview/:inviteCode', getGroupPreview);

router.use(protect);

// Profile Stats
router.get('/profile/stats', getProfileStats);
router.get('/profile/:id', getUserProfileById);

// Discover suggestions
router.get('/discover/suggestions', getDiscoverSuggestions);

// Friends
router.get('/friends', getFriends);
router.post('/friends/search', searchFriendByMobile);
router.post('/friends/request', sendFriendRequest);
router.put('/friends/accept/:id', acceptFriendRequest);
router.put('/friends/reject/:id', rejectFriendRequest);

// Moderation
router.post('/block/:id', blockUser);
router.post('/report/:id', reportUser);

// Groups
router.get('/groups', getGroups);
router.post('/groups', createGroup);
router.put('/groups/:id', editGroup);
router.delete('/groups/:id', deleteGroup);
router.post('/groups/join/:inviteCode', joinGroup);
router.delete('/groups/:id/leave', leaveGroup);
router.post('/groups/:id/members', addMembers);
router.delete('/groups/:id/members/:userId', removeMember);
router.post('/groups/:id/transfer-ownership', transferOwnership);
router.post('/groups/:id/mute', toggleMute);
router.post('/groups/:id/pin', togglePin);
router.get('/groups/:id/messages/search', searchMessages);
router.get('/groups/:id/members', getGroupMembers);
router.post('/groups/:id/messages/seen', markMessagesSeen);
router.get('/group-categories', getGroupCategories);
router.post('/group-categories', createGroupCategory);
router.get('/groups/discover', discoverGroups);

// Chat & Calls
router.get('/chats', getChats);
router.get('/chat/:recipientId', getMessages);
router.get('/calls', getCalls);

// File Uploads for posts
const { uploadPostAttachment } = require('../middleware/uploadMiddleware');
router.post('/posts/upload', uploadPostAttachment.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({
    url: req.file.path,
    name: req.file.originalname,
    size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB'
  });
});

router.post('/posts/upload-multiple', uploadPostAttachment.array('files', 5), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No files uploaded' });
  res.json({
    urls: req.files.map(f => f.path)
  });
});

// Posts CRUD
router.get('/posts', getPosts);
router.post('/posts', createPost);
router.put('/posts/:id', editPost);
router.delete('/posts/:id', deletePost);

// Post Likes
router.post('/posts/:id/like', likePost);

// Post Comments
router.get('/posts/:id/comments', getComments);
router.post('/posts/:id/comments', addComment);
router.put('/posts/comments/:commentId', editComment);
router.delete('/posts/comments/:commentId', deleteComment);

// Post Saves
router.post('/posts/:id/save', savePost);
router.get('/posts/saved', getSavedPosts);

// Post Reports
router.post('/posts/:id/report', reportPost);

// Follow System
router.post('/follow/:id', followUser);
router.post('/unfollow/:id', unfollowUser);

// Stories
router.get('/stories', getStories);
router.post('/stories', createStory);
router.post('/stories/:id/view', viewStory);
router.get('/stories/:id/viewers', getStoryViewers);
router.delete('/stories/:id', deleteStory);

module.exports = router;
