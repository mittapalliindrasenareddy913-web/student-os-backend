/**
 * Decoupled Community Database Repository.
 * Direct database operations querying by public IDs and enforcing collegeCode tenant boundaries.
 */
const Post = require('../../../models/Post');
const Comment = require('../../../models/Comment');
const SavedPost = require('../../../models/SavedPost');
const Like = require('../../../models/Like');
const User = require('../../../models/User');

class CommunityRepository {
  /**
   * Find post by publicId with option to enforce tenant boundary.
   */
  async findPostByPublicId(publicId, collegeCode = null, session = null) {
    const filter = { publicId, isDeleted: false };
    if (collegeCode) {
      filter.collegeCode = collegeCode;
    }
    return await Post.findOne(filter).populate('author', 'fullName username avatar collegeName branch semester').session(session);
  }

  /**
   * Find comment by publicId.
   */
  async findCommentByPublicId(publicId, session = null) {
    return await Comment.findOne({ publicId, isDeleted: false }).populate('author', 'fullName username avatar').session(session);
  }

  /**
   * Create a post.
   */
  async createPost(postData, session = null) {
    const post = new Post(postData);
    await post.save({ session });
    return post;
  }

  /**
   * Update a post.
   */
  async updatePost(publicId, updateData, session = null) {
    return await Post.findOneAndUpdate({ publicId, isDeleted: false }, updateData, { new: true, session });
  }

  /**
   * Soft delete a post.
   */
  async softDeletePost(publicId, session = null) {
    return await Post.findOneAndUpdate(
      { publicId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
      { new: true, session }
    );
  }

  /**
   * Get post feed based on query criteria.
   */
  async getPostsFeed({ collegeCode, filterQuery, sort, skip, limit }) {
    // Force multi-tenant isolation by appending collegeCode to the filter
    const query = {
      ...filterQuery,
      collegeCode,
      isDeleted: false
    };

    // Construct aggregation to count likes length for popular tab
    const aggregation = [
      { $match: query },
      {
        $addFields: {
          likesCount: { $size: { $ifNull: ["$likes", []] } }
        }
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit }
    ];

    const posts = await Post.aggregate(aggregation);
    return await Post.populate(posts, [
      { path: 'author', select: 'fullName username avatar collegeName branch semester' }
    ]);
  }

  /**
   * Count posts in feed.
   */
  async countPostsFeed({ collegeCode, filterQuery }) {
    return await Post.countDocuments({
      ...filterQuery,
      collegeCode,
      isDeleted: false
    });
  }

  /**
   * Like a post.
   */
  async addLike(postId, userId, session = null) {
    return await Post.findByIdAndUpdate(
      postId,
      { $addToSet: { likes: userId } },
      { new: true, session }
    );
  }

  /**
   * Unlike a post.
   */
  async removeLike(postId, userId, session = null) {
    return await Post.findByIdAndUpdate(
      postId,
      { $pull: { likes: userId } },
      { new: true, session }
    );
  }

  /**
   * Create a comment.
   */
  async createComment(commentData, session = null) {
    const comment = new Comment(commentData);
    await comment.save({ session });
    return comment;
  }

  /**
   * Fetch post comments.
   */
  async getCommentsByPostId(postId) {
    return await Comment.find({ post: postId, isDeleted: false })
      .populate('author', 'fullName username avatar branch semester')
      .sort({ createdAt: 1 });
  }

  /**
   * Get saved posts by user.
   */
  async getSavedPostsByUser(userId) {
    return await SavedPost.find({ user: userId })
      .populate({
        path: 'post',
        match: { isDeleted: false },
        populate: { path: 'author', select: 'fullName username avatar' }
      });
  }

  /**
   * Save a post.
   */
  async savePost(userId, postId) {
    return await SavedPost.findOneAndUpdate(
      { user: userId, post: postId },
      { user: userId, post: postId },
      { upsert: true, new: true }
    );
  }

  /**
   * Unsave a post.
   */
  async unsavePost(userId, postId) {
    return await SavedPost.findOneAndDelete({ user: userId, post: postId });
  }
}

module.exports = new CommunityRepository();
