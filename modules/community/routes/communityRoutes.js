/**
 * Decoupled versioned Community Routes.
 */
const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');
const { validateCreatePost, validateCreateComment } = require('../validators/communityValidator');
const { protect } = require('../../../middleware/authMiddleware');
const checkPermission = require('../../../shared/middleware/permissionMiddleware');
const { checkFeature } = require('../../../shared/features/featureFlags');
const { postCommentLimiter, socialActionLimiter } = require('../../../shared/middleware/rateLimiter');

// Enforce authentication & check community feature flag globally
router.use(protect);
router.use(checkFeature('community_feed_active'));

// Feed Retrieval
router.get('/posts', communityController.getPosts);

// Post creation & management
router.post('/posts', 
  postCommentLimiter,
  checkPermission('posts:create'), 
  validateCreatePost, 
  communityController.createPost
);

router.put('/posts/:id', 
  checkPermission('posts:update'), 
  communityController.editPost
);

router.delete('/posts/:id', 
  checkPermission('posts:delete'), 
  communityController.deletePost
);

// Post Likes
router.post('/posts/:id/like', 
  socialActionLimiter,
  checkPermission('posts:like'), 
  communityController.likePost
);

// Post Comments
router.get('/posts/:id/comments', communityController.getComments);
router.post('/posts/:id/comments', 
  postCommentLimiter,
  checkPermission('comments:create'), 
  validateCreateComment, 
  communityController.addComment
);

// Post Saves
router.post('/posts/:id/save', communityController.savePost);

module.exports = router;
