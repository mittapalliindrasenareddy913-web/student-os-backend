/**
 * Centralized Community Feed & Interactions Service.
 * Implements Redis caching, feed ranking, soft deletes, and transactional safety.
 */
const communityRepository = require('../repositories/communityRepository');
const xpService = require('../../gamification/services/xpService');
const { cacheGet, cacheSet, cacheDelPattern } = require('../../../shared/cache/redis');
const { runInTransaction } = require('../../../shared/database/transaction');
const { generatePublicId, formatPagination } = require('../../../shared/utils/helpers');
const { enqueueJob } = require('../../../shared/jobs/queue');
const { logger } = require('../../../shared/logging/logger');
const User = require('../../../models/User');

class CommunityService {
  /**
   * Clears cache for a college workspace feed.
   */
  async clearFeedCache(collegeCode) {
    await cacheDelPattern(`feed:${collegeCode}:*`);
  }

  /**
   * Retrieves paginated, sorted community feed.
   */
  async getFeed(user, { tab = 'latest', page = 1, limit = 10, search = '' }) {
    const collegeCode = user.collegeCode;
    const cacheKey = `feed:${collegeCode}:${tab}:${page}:${limit}:${search}`;

    // 1. Try Redis cache first
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build search filters
    let filterQuery = {};
    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchingAuthors = await User.find({
        $or: [{ fullName: searchRegex }, { username: searchRegex }]
      }).select('_id');
      const authorIds = matchingAuthors.map(u => u._id);

      filterQuery.$or = [
        { title: searchRegex },
        { content: searchRegex },
        { tag: searchRegex },
        { hashtags: searchRegex },
        { subjectTags: searchRegex },
        { author: { $in: authorIds } }
      ];
    }

    if (tab === 'following') {
      const currentUser = await User.findById(user._id);
      const followingIds = currentUser ? currentUser.following || [] : [];
      filterQuery.author = { $in: followingIds };
    } else if (tab === 'my_posts') {
      filterQuery.author = user._id;
    }

    // Set sorting strategy
    let sort = { createdAt: -1 };
    if (tab === 'trending') {
      // Re-rank dynamically based on popularity score (likes count + comments count)
      sort = { likesCount: -1, createdAt: -1 };
    }

    // Fetch from Repository
    const rawPosts = await communityRepository.getPostsFeed({
      collegeCode,
      filterQuery,
      sort,
      skip,
      limit: limitNum
    });

    const totalPosts = await communityRepository.countPostsFeed({
      collegeCode,
      filterQuery
    });

    // Populate dynamic user interactions flag
    const postsWithInteractions = rawPosts.map(post => {
      // Aggregate doesn't return full instances sometimes, check fields safely
      const likesList = post.likes || [];
      return {
        ...post,
        isLiked: likesList.some(id => id.toString() === user._id.toString())
      };
    });

    const paginationMeta = formatPagination(pageNum, limitNum, totalPosts);
    const result = { posts: postsWithInteractions, pagination: paginationMeta };

    // Write back to cache
    await cacheSet(cacheKey, result, 900); // 15-minute TTL

    return result;
  }

  /**
   * Creates a new post.
   */
  async createPost(user, postData) {
    return await runInTransaction(async (session) => {
      const publicId = generatePublicId('POST');
      
      const post = await communityRepository.createPost({
        ...postData,
        publicId,
        collegeCode: user.collegeCode,
        author: user._id
      }, session);

      // Award XP
      await xpService.grantXP(user._id, 'CREATE_POST', session);

      // Clear related cache keys
      await this.clearFeedCache(user.collegeCode);

      return post;
    });
  }

  /**
   * Edits an existing post.
   */
  async updatePost(user, publicId, updateData) {
    const post = await communityRepository.findPostByPublicId(publicId, user.collegeCode);
    if (!post) {
      throw new Error('Post not found or access denied.');
    }

    if (post.author._id.toString() !== user._id.toString() && user.role !== 'principal' && user.role !== 'hod') {
      throw new Error('Unauthorized operation.');
    }

    const updated = await communityRepository.updatePost(publicId, updateData);
    await this.clearFeedCache(user.collegeCode);
    return updated;
  }

  /**
   * Soft deletes a post.
   */
  async deletePost(user, publicId) {
    const post = await communityRepository.findPostByPublicId(publicId, user.collegeCode);
    if (!post) {
      throw new Error('Post not found.');
    }

    // Authors can delete, principals and HODs can soft delete for moderation
    if (post.author._id.toString() !== user._id.toString() && user.role !== 'principal' && user.role !== 'hod') {
      throw new Error('Unauthorized deletion.');
    }

    const deleted = await communityRepository.softDeletePost(publicId);
    await this.clearFeedCache(user.collegeCode);
    return deleted;
  }

  /**
   * Likes/Unlikes a post.
   */
  async toggleLike(user, publicId) {
    return await runInTransaction(async (session) => {
      const post = await communityRepository.findPostByPublicId(publicId, user.collegeCode, session);
      if (!post) throw new Error('Post not found.');

      const hasLiked = post.likes && post.likes.some(id => id.toString() === user._id.toString());
      let updatedPost;

      if (hasLiked) {
        updatedPost = await communityRepository.removeLike(post._id, user._id, session);
      } else {
        updatedPost = await communityRepository.addLike(post._id, user._id, session);
        await xpService.grantXP(user._id, 'LIKE_POST', session);

        // Enqueue decoupled background push notification job
        enqueueJob('NOTIFICATION_DISPATCH', {
          recipientId: post.author._id,
          senderId: user._id,
          type: 'like',
          title: 'New Like',
          body: `${user.fullName} liked your post: "${post.title.substring(0, 30)}..."`,
          link: `/posts/${publicId}`
        }, async (jobData) => {
          // Asynchronously dispatch WebSocket / Socket triggers
          logger.info('Decoupled notification sent for post like', jobData);
        });
      }

      await this.clearFeedCache(user.collegeCode);
      return updatedPost;
    });
  }

  /**
   * Create a comment.
   */
  async addComment(user, publicId, commentText, parentCommentId = null) {
    return await runInTransaction(async (session) => {
      const post = await communityRepository.findPostByPublicId(publicId, user.collegeCode, session);
      if (!post) throw new Error('Post not found.');

      const commentPublicId = generatePublicId('COMM');
      const commentData = {
        publicId: commentPublicId,
        author: user._id,
        post: post._id,
        content: commentText
      };

      if (parentCommentId) {
        const parent = await communityRepository.findCommentByPublicId(parentCommentId, session);
        if (parent) {
          commentData.parentComment = parent._id;
        }
      }

      const comment = await communityRepository.createComment(commentData, session);

      if (parentCommentId && commentData.parentComment) {
        await Comment.findByIdAndUpdate(commentData.parentComment, {
          $addToSet: { replies: comment._id }
        }, { session });
      }

      await xpService.grantXP(user._id, 'CREATE_COMMENT', session);

      // Trigger asynchronous background notification worker
      enqueueJob('NOTIFICATION_DISPATCH', {
        recipientId: post.author._id,
        senderId: user._id,
        type: 'comment',
        title: 'New Comment',
        body: `${user.fullName} commented: "${commentText.substring(0, 30)}..."`,
        link: `/posts/${publicId}`
      }, async (jobData) => {
        logger.info('Decoupled notification sent for post comment', jobData);
      });

      return comment;
    });
  }

  /**
   * Gets comments for a post.
   */
  async getComments(publicId, collegeCode) {
    const post = await communityRepository.findPostByPublicId(publicId, collegeCode);
    if (!post) throw new Error('Post not found.');
    return await communityRepository.getCommentsByPostId(post._id);
  }

  /**
   * Save post.
   */
  async toggleSavePost(user, publicId) {
    const post = await communityRepository.findPostByPublicId(publicId, user.collegeCode);
    if (!post) throw new Error('Post not found.');

    const savedPosts = await communityRepository.getSavedPostsByUser(user._id);
    const isAlreadySaved = savedPosts.some(s => s.post && s.post.publicId === publicId);

    if (isAlreadySaved) {
      await communityRepository.unsavePost(user._id, post._id);
      return { isSaved: false };
    } else {
      await communityRepository.savePost(user._id, post._id);
      return { isSaved: true };
    }
  }
}

module.exports = new CommunityService();
