const Post = require('../models/Post');
const User = require('../models/User');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const SavedPost = require('../models/SavedPost');
const Report = require('../models/Report');
const { createNotification } = require('./notificationController');

// Helper to push WebSocket notification
const pushNotify = async (req, targetUserId, notificationPayload) => {
  try {
    const io = req.app.get('io');
    if (io && targetUserId.toString() !== req.user._id.toString()) {
      await createNotification(io, targetUserId, notificationPayload);
    }
  } catch (err) {
    console.error('Error triggering socket notification:', err);
  }
};

// ── GET POSTS (FEED SYSTEM WITH PAGINATION, TABS AND SEARCH) ───────────────
const getPosts = async (req, res) => {
  try {
    const { tab = 'latest', page = 1, limit = 10, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const currentUser = await User.findById(req.user._id);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    let query = {};

    // Apply Search Filter if search query exists
    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      
      // We search posts (title, content, tags, subjectTags, hashtags) OR search matching authors
      const matchingAuthors = await User.find({
        $or: [
          { fullName: searchRegex },
          { username: searchRegex }
        ]
      }).select('_id');
      
      const authorIds = matchingAuthors.map(u => u._id);

      query.$or = [
        { title: searchRegex },
        { content: searchRegex },
        { tag: searchRegex },
        { location: searchRegex },
        { category: searchRegex },
        { hashtags: searchRegex },
        { subjectTags: searchRegex },
        { author: { $in: authorIds } }
      ];
    }

    // Apply Feed Tab Filters
    if (tab === 'following') {
      // Show posts from authors they follow
      const followings = currentUser.following || [];
      query.author = { $in: followings };
    } else if (tab === 'my_posts') {
      // Show posts made by active user
      query.author = req.user._id;
    }

    // Sort strategy
    let sort = { createdAt: -1 };
    if (tab === 'trending') {
      // Sort by popularity (likes length)
      sort = { likesCount: -1, createdAt: -1 };
    }

    // Calculate post fields on query for popularity sorting
    let aggregation = [
      { $match: query },
      {
        $addFields: {
          likesCount: { $size: { $ifNull: ["$likes", []] } }
        }
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: limitNum }
    ];

    let posts = await Post.aggregate(aggregation);

    // Aggregate doesn't populate automatically, so we populate details manual
    posts = await Post.populate(posts, [
      { path: 'author', select: 'fullName username avatar collegeName branch semester' }
    ]);

    // Also fetch saved post ids of user to append an isSaved flag
    const savedPosts = await SavedPost.find({ user: req.user._id }).select('post');
    const savedSet = new Set(savedPosts.map(s => s.post.toString()));

    const followingsSet = new Set((currentUser.following || []).map(id => id.toString()));

    const formattedPosts = posts.map(post => ({
      ...post,
      isLiked: post.likes && post.likes.some(id => id.toString() === req.user._id.toString()),
      isSaved: savedSet.has(post._id.toString()),
      isFollowing: post.author && followingsSet.has(post.author._id.toString())
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error('[getPosts]', error);
    res.status(500).json({ message: 'Server error fetching feed' });
  }
};

// ── CREATE POST ─────────────────────────────────────────────────────────────
const createPost = async (req, res) => {
  try {
    const {
      title,
      content,
      images = [],
      pdfUrl = null,
      pdfName = null,
      pdfSize = null,
      category = 'text',
      hashtags = [],
      subjectTags = [],
      location = '',
      visibility = 'public',
      allowLikes = true,
      allowComments = true,
      allowShares = true,
      hideLikeCount = false,
      hideCommentsCount = false,
      link = null
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const post = await Post.create({
      author: req.user._id,
      title,
      content,
      images,
      pdfUrl,
      pdfName,
      pdfSize,
      category,
      hashtags,
      subjectTags,
      location,
      visibility,
      allowLikes,
      allowComments,
      allowShares,
      hideLikeCount,
      hideCommentsCount,
      link,
      type: images.length > 0 ? 'image' : pdfUrl ? 'pdf' : 'text',
      tag: category === 'notes' ? 'Study Resource' : category === 'project' ? 'Project Showcase' : 'Social Update'
    });

    const populatedPost = await Post.findById(post._id).populate('author', 'fullName username avatar collegeName branch semester');

    // Broadcast post creation to everyone
    const io = req.app.get('io');
    if (io) {
      io.emit('post_created', {
        ...populatedPost.toObject(),
        isLiked: false,
        isSaved: false,
        isFollowing: false
      });
    }

    res.status(201).json(populatedPost);
  } catch (error) {
    console.error('[createPost]', error);
    res.status(500).json({ message: 'Server error creating post' });
  }
};

// ── EDIT POST (OWNER ONLY) ───────────────────────────────────────────────
const editPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, images, pdfUrl, pdfName, pdfSize, tags, category, hashtags, subjectTags, location } = req.body;

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this post' });
    }

    if (title) post.title = title;
    if (content) post.content = content;
    
    // Clean up replaced/removed images from R2
    if (images && Array.isArray(images)) {
      const deleteFromR2 = require('../utils/deleteFromR2');
      if (post.images && post.images.length > 0) {
        for (const oldImg of post.images) {
          if (!images.includes(oldImg)) {
            await deleteFromR2(oldImg);
          }
        }
      }
      post.images = images;
    }
    
    // Clean up replaced PDF from R2
    if (pdfUrl !== undefined && pdfUrl !== post.pdfUrl) {
      if (post.pdfUrl) {
        const deleteFromR2 = require('../utils/deleteFromR2');
        await deleteFromR2(post.pdfUrl);
      }
      post.pdfUrl = pdfUrl;
    }

    if (pdfName) post.pdfName = pdfName;
    if (pdfSize) post.pdfSize = pdfSize;
    if (category) post.category = category;
    if (hashtags) post.hashtags = hashtags;
    if (subjectTags) post.subjectTags = subjectTags;
    if (location !== undefined) post.location = location;

    await post.save();
    const populatedPost = await Post.findById(post._id).populate('author', 'fullName username avatar collegeName branch semester');
    
    // Broadcast post edits to everyone
    const io = req.app.get('io');
    if (io) {
      io.emit('post_updated', populatedPost);
    }

    res.json(populatedPost);
  } catch (error) {
    console.error('[editPost]', error);
    res.status(500).json({ message: 'Server error editing post' });
  }
};

// ── DELETE POST (OWNER ONLY) ─────────────────────────────────────────────
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // Delete associated files from R2
    const deleteFromR2 = require('../utils/deleteFromR2');
    if (post.images && post.images.length > 0) {
      for (const imgUrl of post.images) {
        await deleteFromR2(imgUrl);
      }
    }
    if (post.pdfUrl) {
      await deleteFromR2(post.pdfUrl);
    }
    if (post.fileUrl) {
      await deleteFromR2(post.fileUrl);
    }

    await Post.findByIdAndDelete(id);
    // Delete cascading likes, comments, and saved entries
    await Like.deleteMany({ post: id });
    await Comment.deleteMany({ post: id });
    await SavedPost.deleteMany({ post: id });

    // Broadcast post deletion to everyone
    const io = req.app.get('io');
    if (io) {
      io.emit('post_deleted', { postId: id });
    }

    res.json({ message: 'Post deleted successfully', postId: id });
  } catch (error) {
    console.error('[deletePost]', error);
    res.status(500).json({ message: 'Server error deleting post' });
  }
};

// ── LIKE / UNLIKE POST ──────────────────────────────────────────────────
const likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const existingLike = await Like.findOne({ user: req.user._id, post: id });
    let liked = false;

    if (existingLike) {
      // Unlike post
      await Like.findByIdAndDelete(existingLike._id);
      post.likes = post.likes.filter(uid => uid.toString() !== req.user._id.toString());
      liked = false;
    } else {
      // Like post
      await Like.create({ user: req.user._id, post: id });
      post.likes.push(req.user._id);
      liked = true;

      // Trigger Notification
      const sender = await User.findById(req.user._id).select('fullName avatar');
      await pushNotify(req, post.author, {
        title: 'New Like',
        message: `${sender.fullName} liked your post: "${post.title.substring(0, 20)}..."`,
        type: 'alert',
        senderId: req.user._id,
        senderName: sender.fullName,
        senderAvatar: sender.avatar || '',
        relatedId: post._id.toString(),
        link: `/community`
      });
    }

    await post.save();

    // Broadcast post like status update
    const io = req.app.get('io');
    if (io) {
      io.emit('post_liked', {
        postId: id,
        likesCount: post.likes.length,
        likes: post.likes.map(uid => uid.toString())
      });
    }

    res.json({ likesCount: post.likes.length, isLiked: liked });
  } catch (error) {
    console.error('[likePost]', error);
    res.status(500).json({ message: 'Server error liking post' });
  }
};

// ── COMMENTS (NESTED SYSTEM) ────────────────────────────────────────────
const getComments = async (req, res) => {
  try {
    const { id } = req.params;
    // Retrieve parent comments (parentComment is null)
    const comments = await Comment.find({ post: id, parentComment: null })
      .populate('author', 'fullName username avatar')
      .populate({
        path: 'replies',
        populate: { path: 'author', select: 'fullName username avatar' }
      })
      .sort({ createdAt: 1 });

    res.json(comments);
  } catch (error) {
    console.error('[getComments]', error);
    res.status(500).json({ message: 'Server error fetching comments' });
  }
};

const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, parentCommentId = null } = req.body;

    if (!content) return res.status(400).json({ message: 'Content is required' });

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const comment = await Comment.create({
      author: req.user._id,
      post: id,
      content,
      parentComment: parentCommentId
    });

    if (parentCommentId) {
      // Append comment ID to parent replies array
      const parentComment = await Comment.findById(parentCommentId);
      if (parentComment) {
        parentComment.replies.push(comment._id);
        await parentComment.save();

        // Notify parent comment author
        const sender = await User.findById(req.user._id).select('fullName avatar');
        await pushNotify(req, parentComment.author, {
          title: 'New Reply',
          message: `${sender.fullName} replied to your comment.`,
          type: 'alert',
          senderId: req.user._id,
          senderName: sender.fullName,
          senderAvatar: sender.avatar || '',
          relatedId: post._id.toString(),
          link: `/community`
        });
      }
    } else {
      // Add count to legacy commentsList array on post to maintain structure
      post.commentsList.push({ author: req.user._id, content });
      await post.save();

      // Notify post author
      const sender = await User.findById(req.user._id).select('fullName avatar');
      await pushNotify(req, post.author, {
        title: 'New Comment',
        message: `${sender.fullName} commented on your post: "${post.title.substring(0, 20)}..."`,
        type: 'alert',
        senderId: req.user._id,
        senderName: sender.fullName,
        senderAvatar: sender.avatar || '',
        relatedId: post._id.toString(),
        link: `/community`
      });
    }

    const populatedComment = await Comment.findById(comment._id).populate('author', 'fullName username avatar');

    // Broadcast comment addition to everyone
    const io = req.app.get('io');
    if (io) {
      io.emit('comment_added', { postId: id, comment: populatedComment });
    }

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error('[addComment]', error);
    res.status(500).json({ message: 'Server error adding comment' });
  }
};

const editComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    comment.content = content;
    comment.isEdited = true;
    await comment.save();

    const populated = await Comment.findById(comment._id).populate('author', 'fullName username avatar');
    
    // Broadcast comment edit
    const io = req.app.get('io');
    if (io) {
      io.emit('comment_edited', { postId: comment.post.toString(), comment: populated });
    }

    res.json(populated);
  } catch (error) {
    console.error('[editComment]', error);
    res.status(500).json({ message: 'Server error editing comment' });
  }
};

const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Comment.findByIdAndDelete(commentId);
    // If it's a sub-reply, pull reference from parent
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, {
        $pull: { replies: commentId }
      });
    } else {
      // Also delete children replies
      await Comment.deleteMany({ parentComment: commentId });
    }

    // Broadcast comment deletion
    const io = req.app.get('io');
    if (io) {
      io.emit('comment_deleted', { postId: comment.post.toString(), commentId });
    }

    res.json({ message: 'Comment deleted successfully', commentId });
  } catch (error) {
    console.error('[deleteComment]', error);
    res.status(500).json({ message: 'Server error deleting comment' });
  }
};

// ── SAVE / BOOKMARK POSTS ────────────────────────────────────────────────
const savePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const existingSave = await SavedPost.findOne({ user: req.user._id, post: id });
    let saved = false;

    if (existingSave) {
      await SavedPost.findByIdAndDelete(existingSave._id);
      saved = false;
    } else {
      await SavedPost.create({ user: req.user._id, post: id });
      saved = true;
    }

    res.json({ isSaved: saved });
  } catch (error) {
    console.error('[savePost]', error);
    res.status(500).json({ message: 'Server error saving post' });
  }
};

const getSavedPosts = async (req, res) => {
  try {
    const saved = await SavedPost.find({ user: req.user._id })
      .populate({
        path: 'post',
        populate: { path: 'author', select: 'fullName username avatar collegeName branch semester' }
      })
      .sort({ createdAt: -1 });

    const posts = saved.map(s => {
      if (!s.post) return null;
      return {
        ...s.post._doc,
        isSaved: true
      };
    }).filter(Boolean);

    res.json(posts);
  } catch (error) {
    console.error('[getSavedPosts]', error);
    res.status(500).json({ message: 'Server error fetching saved posts' });
  }
};

// ── REPORT POSTS ─────────────────────────────────────────────────────────
const reportPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, description = '' } = req.body;

    if (!['Spam', 'Abuse', 'Fake', 'Other'].includes(reason)) {
      return res.status(400).json({ message: 'Invalid report reason' });
    }

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const report = await Report.create({
      reporter: req.user._id,
      post: id,
      reason,
      description
    });

    res.status(201).json({ message: 'Post reported successfully', reportId: report._id });
  } catch (error) {
    console.error('[reportPost]', error);
    res.status(500).json({ message: 'Server error reporting post' });
  }
};

// ── FOLLOW / UNFOLLOW SYSTEM ─────────────────────────────────────────────
const followUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    const currentUser = await User.findById(req.user._id);

    // Add to following of current user
    if (!currentUser.following.includes(id)) {
      currentUser.following.push(id);
      await currentUser.save();
    }

    // Add to followers of target user
    if (!targetUser.followers.includes(req.user._id)) {
      targetUser.followers.push(req.user._id);
      await targetUser.save();

      // Trigger follow notification
      const sender = await User.findById(req.user._id).select('fullName avatar');
      await pushNotify(req, id, {
        title: 'New Follower',
        message: `${sender.fullName} started following you.`,
        type: 'alert',
        senderId: req.user._id,
        senderName: sender.fullName,
        senderAvatar: sender.avatar || '',
        relatedId: req.user._id.toString(),
        link: `/community`
      });
    }

    res.json({ 
      message: 'User followed successfully', 
      isFollowing: true,
      followersCount: targetUser.followers.length,
      followingCount: currentUser.following.length
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('follow_updated', {
        followerId: req.user._id.toString(),
        followingId: id,
        followersCount: targetUser.followers.length,
        followingCount: currentUser.following.length
      });
    }
  } catch (error) {
    console.error('[followUser]', error);
    res.status(500).json({ message: 'Server error following user' });
  }
};

const unfollowUser = async (req, res) => {
  try {
    const { id } = req.params;
    const targetUser = await User.findById(id);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    const currentUser = await User.findById(req.user._id);

    // Remove from following of current user
    currentUser.following = currentUser.following.filter(uid => uid.toString() !== id);
    await currentUser.save();

    // Remove from followers of target user
    targetUser.followers = targetUser.followers.filter(uid => uid.toString() !== req.user._id.toString());
    await targetUser.save();

    res.json({ 
      message: 'User unfollowed successfully', 
      isFollowing: false,
      followersCount: targetUser.followers.length,
      followingCount: currentUser.following.length
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('follow_updated', {
        followerId: req.user._id.toString(),
        followingId: id,
        followersCount: targetUser.followers.length,
        followingCount: currentUser.following.length
      });
    }
  } catch (error) {
    console.error('[unfollowUser]', error);
    res.status(500).json({ message: 'Server error unfollowing user' });
  }
};

const Group = require('../models/Group');

const getProfileStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('followers following');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const postsCount = await Post.countDocuments({ author: userId });
    const followersCount = user.followers ? user.followers.length : 0;
    const followingCount = user.following ? user.following.length : 0;
    const groupsCount = await Group.countDocuments({ members: userId });
    const notesCount = await Post.countDocuments({ author: userId, category: 'notes' });
    const savedPostsCount = await SavedPost.countDocuments({ user: userId });

    res.json({
      postsCount,
      followersCount,
      followingCount,
      groupsCount,
      notesCount,
      savedPostsCount
    });
  } catch (error) {
    console.error('[getProfileStats]', error);
    res.status(500).json({ message: 'Server error retrieving profile statistics' });
  }
};

const getUserProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    const targetUser = await User.findById(id).select('-password');
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    const postsCount = await Post.countDocuments({ author: id });
    const followersCount = targetUser.followers ? targetUser.followers.length : 0;
    const followingCount = targetUser.following ? targetUser.following.length : 0;
    const groupsCount = await Group.countDocuments({ members: id });
    const notesCount = await Post.countDocuments({ author: id, category: 'notes' });
    const savedPostsCount = await SavedPost.countDocuments({ user: id });

    const isFollowing = targetUser.followers ? targetUser.followers.includes(req.user._id) : false;

    const recentPosts = await Post.find({ author: id })
      .populate('author', 'fullName username avatar branch collegeName')
      .sort({ createdAt: -1 })
      .limit(10);

    const vis = targetUser.visibilitySettings || {};
    const isMyself = targetUser._id.toString() === req.user._id.toString();

    const canShow = (key) => {
      const visibility = vis[key] || 'public';
      if (visibility === 'public') return true;
      if (visibility === 'followers' && (isFollowing || isMyself)) return true;
      if (visibility === 'private' && isMyself) return true;
      return false;
    };

    const sanitizedUser = {
      _id: targetUser._id,
      fullName: targetUser.fullName,
      username: targetUser.username,
      avatar: targetUser.avatar,
      coverPhoto: targetUser.coverPhoto,
      collegeName: targetUser.collegeName,
      branch: targetUser.branch,
      year: targetUser.year,
      semester: targetUser.semester,
      rollNumber: targetUser.rollNumber,
      bio: targetUser.bio || '',
      skills: targetUser.skills || [],
      interests: targetUser.interests || [],
      location: canShow('location') ? targetUser.location : undefined,
      email: canShow('email') ? targetUser.email : undefined,
      mobileNumber: canShow('mobileNumber') ? targetUser.mobileNumber : undefined,
      
      githubUrl: canShow('githubUrl') ? targetUser.githubUrl : undefined,
      linkedinUrl: canShow('linkedinUrl') ? targetUser.linkedinUrl : undefined,
      portfolioUrl: canShow('portfolioUrl') ? targetUser.portfolioUrl : undefined,
      websiteUrl: canShow('websiteUrl') ? targetUser.websiteUrl : undefined,
      instagramUrl: canShow('instagramUrl') ? targetUser.instagramUrl : undefined,
      xUrl: canShow('xUrl') ? targetUser.xUrl : undefined,
      youtubeUrl: canShow('youtubeUrl') ? targetUser.youtubeUrl : undefined,
      telegramUrl: canShow('telegramUrl') ? targetUser.telegramUrl : undefined,
      
      visibilitySettings: targetUser.visibilitySettings,
      openToOpportunities: targetUser.openToOpportunities,
      projects: targetUser.projects || [],
      certificates: targetUser.certificates || [],
      internships: targetUser.internships || [],
      hackathons: targetUser.hackathons || [],
      achievements: targetUser.achievements || []
    };

    res.json({
      user: sanitizedUser,
      stats: {
        postsCount,
        followersCount,
        followingCount,
        groupsCount,
        notesCount,
        savedPostsCount
      },
      isFollowing,
      recentPosts
    });
  } catch (error) {
    console.error('[getUserProfileById]', error);
    res.status(500).json({ message: 'Server error retrieving user profile' });
  }
};

module.exports = {
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
};
