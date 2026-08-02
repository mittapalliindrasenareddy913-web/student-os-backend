/**
 * Standardized Community Controller.
 * Handles HTTP parsing, tracing, audit logging, and payload validation routing.
 */
const communityService = require('../services/communityService');
const { sendSuccess, sendFailure } = require('../../../shared/utils/helpers');
const { writeAuditLog } = require('../../../shared/logging/auditLogService');
const { logger } = require('../../../shared/logging/logger');
const User = require('../../../models/User');

class CommunityController {
  async getPosts(req, res) {
    try {
      const { tab = 'latest', page = 1, limit = 10, search = '' } = req.query;
      const result = await communityService.getFeed(req.user, { tab, page, limit, search });
      return sendSuccess(res, 'Feed retrieved successfully.', result.posts, 200, result.pagination);
    } catch (err) {
      logger.error('Failed to retrieve community feed', { error: err.message, reqId: req.reqId });
      return sendFailure(res, 'Failed to fetch feed.', 'FEED_FETCH_ERROR', err.message, 500);
    }
  }

  async createPost(req, res) {
    try {
      const post = await communityService.createPost(req.user, req.body);
      await writeAuditLog(req, {
        action: 'CREATE_POST',
        actorId: req.user._id,
        actorRole: req.user.role,
        collegeCode: req.user.collegeCode,
        targetId: post.publicId,
        newValues: post
      });
      return sendSuccess(res, 'Post created successfully.', post, 201);
    } catch (err) {
      logger.error('Failed to create post', { error: err.message, reqId: req.reqId });
      return sendFailure(res, 'Failed to create post.', 'POST_CREATE_ERROR', err.message, 500);
    }
  }

  async editPost(req, res) {
    try {
      const { id } = req.params; // post publicId
      const updated = await communityService.updatePost(req.user, id, req.body);
      await writeAuditLog(req, {
        action: 'UPDATE_POST',
        actorId: req.user._id,
        actorRole: req.user.role,
        collegeCode: req.user.collegeCode,
        targetId: id,
        newValues: updated
      });
      return sendSuccess(res, 'Post updated successfully.', updated, 200);
    } catch (err) {
      logger.error('Failed to update post', { error: err.message, reqId: req.reqId });
      return sendFailure(res, err.message, 'POST_UPDATE_ERROR', err.message, 400);
    }
  }

  async deletePost(req, res) {
    try {
      const { id } = req.params; // post publicId
      await communityService.deletePost(req.user, id);
      await writeAuditLog(req, {
        action: 'DELETE_POST',
        actorId: req.user._id,
        actorRole: req.user.role,
        collegeCode: req.user.collegeCode,
        targetId: id
      });
      return sendSuccess(res, 'Post deleted successfully.', {}, 200);
    } catch (err) {
      logger.error('Failed to delete post', { error: err.message, reqId: req.reqId });
      return sendFailure(res, err.message, 'POST_DELETE_ERROR', err.message, 400);
    }
  }

  async likePost(req, res) {
    try {
      const { id } = req.params; // post publicId
      const post = await communityService.toggleLike(req.user, id);
      return sendSuccess(res, 'Like toggled successfully.', { likesCount: post.likes.length }, 200);
    } catch (err) {
      logger.error('Failed to toggle post like', { error: err.message, reqId: req.reqId });
      return sendFailure(res, err.message, 'POST_LIKE_ERROR', err.message, 400);
    }
  }

  async getComments(req, res) {
    try {
      const { id } = req.params; // post publicId
      const comments = await communityService.getComments(id, req.user.collegeCode);
      return sendSuccess(res, 'Comments retrieved successfully.', comments, 200);
    } catch (err) {
      logger.error('Failed to get post comments', { error: err.message, reqId: req.reqId });
      return sendFailure(res, err.message, 'GET_COMMENTS_ERROR', err.message, 400);
    }
  }

  async addComment(req, res) {
    try {
      const { id } = req.params; // post publicId
      const { content, parentCommentId } = req.body;
      const comment = await communityService.addComment(req.user, id, content, parentCommentId);
      await writeAuditLog(req, {
        action: 'CREATE_COMMENT',
        actorId: req.user._id,
        actorRole: req.user.role,
        collegeCode: req.user.collegeCode,
        targetId: comment.publicId,
        newValues: comment
      });
      return sendSuccess(res, 'Comment added successfully.', comment, 201);
    } catch (err) {
      logger.error('Failed to add comment', { error: err.message, reqId: req.reqId });
      return sendFailure(res, err.message, 'ADD_COMMENT_ERROR', err.message, 400);
    }
  }

  async savePost(req, res) {
    try {
      const { id } = req.params;
      const result = await communityService.toggleSavePost(req.user, id);
      return sendSuccess(res, result.isSaved ? 'Post saved successfully.' : 'Post unsaved successfully.', result, 200);
    } catch (err) {
      logger.error('Failed to toggle save post', { error: err.message, reqId: req.reqId });
      return sendFailure(res, err.message, 'SAVE_POST_ERROR', err.message, 400);
    }
  }
}

module.exports = new CommunityController();
