const User = require('../models/User');
const Group = require('../models/Group');
const Message = require('../models/Message');
const GroupMessage = require('../models/GroupMessage');
const Call = require('../models/Call');
const Post = require('../models/Post');
const Story = require('../models/Story');
const { createNotification } = require('./notificationController');

// ── Helpers ──────────────────────────────────────────────────────────────
const sanitizeFriend = (user) => {
  if (user.profileVisibility === 'private') {
    return {
      _id: user._id,
      fullName: 'Private Profile',
      avatar: user.fullName ? user.fullName.charAt(0).toUpperCase() : '?',
      isPrivate: true
    };
  }
  return {
    _id: user._id,
    fullName: user.fullName,
    avatar: user.avatar,
    collegeName: user.collegeName,
    branch: user.branch,
    semester: user.semester
  };
};

// ── @route  GET /api/community/friends ──────────────────────────────────
// List accepted friends and pending requests
const getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'fullName avatar collegeName branch semester profileVisibility')
      .populate('friendRequests.user', 'fullName avatar collegeName branch semester profileVisibility');

    if (!user) return res.status(404).json({ message: 'User not found' });

    const friends = user.friends
      .filter(f => !user.blockedUsers.some(b => b.toString() === f._id.toString()))
      .map(f => ({
        _id: f._id,
        fullName: f.fullName,
        avatar: f.avatar,
        collegeName: f.collegeName,
        branch: f.branch,
        semester: f.semester
      }));
      
    const requests = user.friendRequests
      .filter(r => r.status === 'pending' && !user.blockedUsers.some(b => b.toString() === r.user._id.toString()))
      .map(r => {
        if (r.user.profileVisibility === 'private') {
          return {
            _id: r.user._id,
            fullName: 'Private Profile',
            avatar: r.user.fullName ? r.user.fullName.charAt(0).toUpperCase() : '?',
            isPrivate: true,
            createdAt: r.createdAt
          };
        }
        return {
          _id: r.user._id,
          fullName: r.user.fullName,
          avatar: r.user.avatar || r.user.fullName.charAt(0).toUpperCase(),
          createdAt: r.createdAt
        };
      });

    res.json({ friends, requests });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching friends' });
  }
};

// ── @route  POST /api/community/friends/search ─────────────────────────
// Search user by username, student ID, mobile number, or full name (returns list)
const searchFriendByMobile = async (req, res) => {
  try {
    const searchVal = (req.body.query || req.body.mobileNumber || '').trim();
    if (!searchVal) return res.status(400).json({ message: 'Search query is required' });

    const strippedUsername = searchVal.startsWith('@') ? searchVal.substring(1).toLowerCase() : searchVal.toLowerCase();
    const searchValLower = searchVal.toLowerCase();

    const orQuery = [
      { mobileNumber: searchVal },
      { studentId: searchVal },
      { username: { $regex: new RegExp(strippedUsername, 'i') } },
      { fullName: { $regex: new RegExp(searchVal, 'i') } },
      { 'openToOpportunities.custom': { $regex: new RegExp(searchVal, 'i') } }
    ];

    if (searchValLower.includes('internship')) orQuery.push({ 'openToOpportunities.internships': true });
    if (searchValLower.includes('team member') || searchValLower.includes('team')) orQuery.push({ 'openToOpportunities.teamMembers': true });
    if (searchValLower.includes('hackathon')) orQuery.push({ 'openToOpportunities.hackathons': true });
    if (searchValLower.includes('freelance')) orQuery.push({ 'openToOpportunities.freelance': true });
    if (searchValLower.includes('mentor')) orQuery.push({ 'openToOpportunities.mentoring': true });
    if (searchValLower.includes('collaborator') || searchValLower.includes('project')) orQuery.push({ 'openToOpportunities.projectCollaborators': true });
    if (searchValLower.includes('study partner') || searchValLower.includes('study')) orQuery.push({ 'openToOpportunities.studyPartners': true });
    if (searchValLower.includes('placement') || searchValLower.includes('group')) orQuery.push({ 'openToOpportunities.placementGroups': true });

    const matchedUsers = await User.find({
      _id: { $ne: req.user._id },
      $or: orQuery
    }).limit(20);

    const sanitizedUsers = matchedUsers.map(matchedUser => {
      const isFriend = req.user.friends && req.user.friends.some(f => f.toString() === matchedUser._id.toString());
      return {
        _id: matchedUser._id,
        fullName: matchedUser.fullName,
        username: matchedUser.username,
        studentId: matchedUser.studentId,
        avatar: matchedUser.avatar,
        collegeName: matchedUser.collegeName,
        branch: matchedUser.branch,
        semester: matchedUser.semester,
        rollNumber: matchedUser.rollNumber,
        profileVisibility: matchedUser.profileVisibility,
        openToOpportunities: matchedUser.openToOpportunities,
        email: isFriend ? matchedUser.email : undefined,
        mobileNumber: isFriend ? matchedUser.mobileNumber : undefined
      };
    });

    res.json(sanitizedUsers);
  } catch (error) {
    console.error('[searchFriend]', error);
    res.status(500).json({ message: 'Server error during search' });
  }
};

// ── @route  POST /api/community/friends/request ────────────────────────
const sendFriendRequest = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot send request to yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Check if already friends
    if (targetUser.friends.some(f => f.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: 'Already friends' });
    }

    // Check if request already exists
    const existingReq = targetUser.friendRequests.find(r => r.user.toString() === req.user._id.toString() && r.status === 'pending');
    if (existingReq) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    targetUser.friendRequests.push({ user: req.user._id, status: 'pending' });
    await targetUser.save();

    // Notify the target user in real-time
    const io = req.app.get('io');
    const sender = await User.findById(req.user._id).select('fullName avatar');
    await createNotification(io, targetUserId, {
      title: 'New Friend Request',
      message: `${sender.fullName} sent you a friend request.`,
      type: 'friend_request',
      senderId: sender._id,
      senderName: sender.fullName,
      senderAvatar: sender.avatar || '',
      relatedId: sender._id.toString(),
      link: '/community'
    });

    res.json({ message: 'Friend request sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error sending request' });
  }
};

// ── @route  PUT /api/community/friends/accept/:id ──────────────────────
const acceptFriendRequest = async (req, res) => {
  try {
    const requesterId = req.params.id;
    const user = await User.findById(req.user._id);

    const requestIndex = user.friendRequests.findIndex(r => r.user.toString() === requesterId && r.status === 'pending');
    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Accept request
    user.friendRequests[requestIndex].status = 'accepted';
    
    // Add to friends lists
    if (!user.friends.some(f => f.toString() === requesterId)) user.friends.push(requesterId);
    await user.save();

    // Add to other user's friends list
    const requester = await User.findById(requesterId);
    if (requester && !requester.friends.some(f => f.toString() === user._id.toString())) {
      requester.friends.push(user._id);
      await requester.save();
    }

    // Notify the requester that their request was accepted
    const io = req.app.get('io');
    await createNotification(io, requesterId, {
      title: 'Friend Request Accepted',
      message: `${user.fullName} accepted your friend request.`,
      type: 'friend_accepted',
      senderId: user._id,
      senderName: user.fullName,
      senderAvatar: user.avatar || '',
      relatedId: user._id.toString(),
      link: '/community'
    });

    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error accepting request' });
  }
};

// ── @route  PUT /api/community/friends/reject/:id ──────────────────────
const rejectFriendRequest = async (req, res) => {
  try {
    const requesterId = req.params.id;
    const user = await User.findById(req.user._id);

    const requestIndex = user.friendRequests.findIndex(r => r.user.toString() === requesterId && r.status === 'pending');
    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    user.friendRequests[requestIndex].status = 'rejected';
    await user.save();

    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    res.status(500).json({ message: 'Server error rejecting request' });
  }
};

// ── GROUPS ─────────────────────────────────────────────────────────────

// ── @route  GET /api/community/groups ──────────────────────────────────
const getGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .select('name description type avatar members admin inviteCode')
      .lean();
    
    res.json(groups.map(g => ({ ...g, memberCount: g.members.length })));
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching groups' });
  }
};

// ── @route  POST /api/community/groups ─────────────────────────────────
const createGroup = async (req, res) => {
  try {
    const { name, description, semester, type } = req.body;
    
    if (!name) return res.status(400).json({ message: 'Group name is required' });

    // Generate random invite code
    const inviteCode = Math.random().toString(36).substring(2, 10);

    const group = await Group.create({
      name,
      description,
      semester,
      type: type || 'public',
      admin: req.user._id,
      members: [req.user._id],
      inviteCode
    });

    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: 'Server error creating group' });
  }
};

// ── @route  POST /api/community/groups/join/:inviteCode ───────────────
const joinGroup = async (req, res) => {
  try {
    const group = await Group.findOne({ inviteCode: req.params.inviteCode });
    if (!group) return res.status(404).json({ message: 'Invalid invite link' });

    if (group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: 'Already a member of this group' });
    }

    group.members.push(req.user._id);
    await group.save();

    res.json({ message: 'Successfully joined group', group });
  } catch (error) {
    res.status(500).json({ message: 'Server error joining group' });
  }
};

// ── CHAT MESSAGES ──────────────────────────────────────────────────────

// ── @route  GET /api/community/chats ───────────────────────────────────────
const getChats = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Find all 1-on-1 messages involving the current user
    const messages = await Message.find({
      isGroup: false,
      $or: [
        { sender: currentUserId },
        { recipient: currentUserId }
      ]
    })
    .sort({ createdAt: -1 });

    // Extract unique classmate IDs and their latest message
    const chatMap = new Map();
    messages.forEach(msg => {
      const otherId = msg.sender.toString() === currentUserId.toString()
        ? msg.recipient.toString()
        : msg.sender.toString();
      
      if (!chatMap.has(otherId)) {
        chatMap.set(otherId, msg);
      }
    });

    // Populate classmate details
    const uniqueIds = Array.from(chatMap.keys());
    const classmates = await User.find({ _id: { $in: uniqueIds } })
      .select('fullName username avatar collegeName branch semester');

    const formattedChats = classmates.map(c => {
      const lastMsg = chatMap.get(c._id.toString());
      
      // Calculate unread count
      const unreadCount = messages.filter(msg => 
        msg.sender.toString() === c._id.toString() && 
        !msg.readBy.some(uid => uid.toString() === currentUserId.toString())
      ).length;

      return {
        _id: c._id,
        user: c,
        lastMessage: lastMsg.content || (lastMsg.fileUrl ? '[Attachment]' : ''),
        lastMessageTime: lastMsg.createdAt,
        unreadCount
      };
    });

    // Sort by latest message time descending
    formattedChats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    res.json(formattedChats);
  } catch (error) {
    console.error('[getChats]', error);
    res.status(500).json({ message: 'Server error fetching chats' });
  }
};

// ── @route  GET /api/community/chat/:recipientId ───────────────────────
const getMessages = async (req, res) => {
  try {
    const { recipientId } = req.params;
    const { isGroup } = req.query; // ?isGroup=true

    let messages = [];

    if (isGroup === 'true') {
      const group = await Group.findById(recipientId);
      if (!group || !group.members.some(m => m.toString() === req.user._id.toString())) {
        return res.status(403).json({ message: 'Not authorized to view this group' });
      }
      messages = await GroupMessage.find({ group: recipientId })
        .populate('sender', 'fullName avatar')
        .populate({
          path: 'replyTo',
          select: 'content sender',
          populate: { path: 'sender', select: 'fullName' }
        })
        .sort({ createdAt: 1 });
    } else {
      // 1-on-1 Chat
      const currentUser = await User.findById(req.user._id).select('blockedUsers');
      const isBlocked = currentUser.blockedUsers.some(b => b.toString() === recipientId.toString());

      if (isBlocked) {
        messages = []; // Do not return messages if user is blocked
      } else {
        messages = await Message.find({
          isGroup: false,
          $or: [
            { sender: req.user._id, recipient: recipientId },
            { sender: recipientId, recipient: req.user._id }
          ]
        })
        .populate('sender', 'fullName avatar')
        .sort({ createdAt: 1 });
      }
    }

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching messages' });
  }
};

// ── @route  GET /api/community/calls ──────────────────────────────────────
const getCalls = async (req, res) => {
  try {
    const calls = await Call.find({
      $or: [{ caller: req.user._id }, { receiver: req.user._id }]
    })
    .populate('caller', 'fullName avatar')
    .populate('receiver', 'fullName avatar')
    .sort({ createdAt: -1 })
    .limit(50); // Get last 50 calls

    res.json(calls);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching calls' });
  }
};

// ── MODERATION ─────────────────────────────────────────────────────────

// ── @route  POST /api/community/block/:id ──────────────────────────────
const blockUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    const user = await User.findById(req.user._id);

    if (targetId === user._id.toString()) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    if (!user.blockedUsers.some(b => b.toString() === targetId.toString())) {
      user.blockedUsers.push(targetId);
      
      // Remove from friends
      user.friends = user.friends.filter(f => f.toString() !== targetId);
      
      // Remove any pending requests
      user.friendRequests = user.friendRequests.filter(r => r.user.toString() !== targetId);
      
      await user.save();

      // Also remove from target's friends list
      const targetUser = await User.findById(targetId);
      if (targetUser) {
        targetUser.friends = targetUser.friends.filter(f => f.toString() !== user._id.toString());
        await targetUser.save();
      }
    }

    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error blocking user' });
  }
};

// ── @route  POST /api/community/report/:id ─────────────────────────────
const reportUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    const { reason } = req.body;
    const user = await User.findById(req.user._id);

    if (!['Spam', 'Abuse', 'Fake Account', 'Other'].includes(reason)) {
      return res.status(400).json({ message: 'Invalid report reason' });
    }

    user.reportedUsers.push({ user: targetId, reason });
    await user.save();

    res.json({ message: 'User reported successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error reporting user' });
  }
};

// ── @route  DELETE /api/community/groups/:id/leave ─────────────────────
const leaveGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const group = await Group.findById(groupId);

    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.admin.toString() === req.user._id.toString()) {
      // Admin is leaving -> Delete the group completely
      await Group.findByIdAndDelete(groupId);
      await Message.deleteMany({ recipient: groupId, isGroup: true });
      return res.json({ message: 'Group deleted successfully' });
    } else {
      // Normal member leaving
      group.members = group.members.filter(m => m.toString() !== req.user._id.toString());
      await group.save();
      return res.json({ message: 'Left group successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error leaving group' });
  }
};

const getGroupPreview = async (req, res) => {
  try {
    const group = await Group.findOne({ inviteCode: req.params.inviteCode })
      .select('name description semester members')
      .lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    res.json({
      name: group.name,
      description: group.description,
      semester: group.semester,
      memberCount: group.members.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching group preview' });
  }
};

const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', 'fullName username avatar collegeName isVerified')
      .populate('commentsList.author', 'fullName username avatar')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching posts' });
  }
};

const createPost = async (req, res) => {
  try {
    const { type, title, content, fileUrl, fileName, fileSize, link, tag, allowLikes, allowComments, allowShares, visibility, hideLikeCount, hideCommentsCount } = req.body;
    if (!title || !content) return res.status(400).json({ message: 'Title and content are required' });

    const post = await Post.create({
      author: req.user._id,
      type,
      title,
      content,
      fileUrl,
      fileName,
      fileSize,
      link,
      tag,
      allowLikes,
      allowComments,
      allowShares,
      visibility,
      hideLikeCount,
      hideCommentsCount
    });

    const populatedPost = await Post.findById(post._id).populate('author', 'fullName username avatar collegeName isVerified');
    res.status(201).json(populatedPost);
  } catch (error) {
    res.status(500).json({ message: 'Server error creating post' });
  }
};

const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const likedIndex = post.likes.indexOf(req.user._id);
    if (likedIndex > -1) {
      post.likes.splice(likedIndex, 1);
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();
    const populatedPost = await Post.findById(post._id)
      .populate('author', 'fullName username avatar collegeName isVerified')
      .populate('commentsList.author', 'fullName username avatar');
    res.json(populatedPost);
  } catch (error) {
    res.status(500).json({ message: 'Server error liking post' });
  }
};

const commentPost = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'Comment content is required' });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    post.commentsList.push({
      author: req.user._id,
      content
    });

    await post.save();
    const populatedPost = await Post.findById(post._id)
      .populate('author', 'fullName username avatar collegeName isVerified')
      .populate('commentsList.author', 'fullName username avatar');
    res.json(populatedPost);
  } catch (error) {
    res.status(500).json({ message: 'Server error adding comment' });
  }
};

const getStories = async (req, res) => {
  try {
    const followedUserIds = req.user.following || [];
    const stories = await Story.find({
      $or: [
        { user: req.user._id },
        { user: { $in: followedUserIds } },
        { visibility: 'public' }
      ]
    })
      .populate('user', 'fullName username avatar branch collegeName')
      .sort({ createdAt: -1 });
    res.json(stories);
  } catch (error) {
    console.error('[getStories]', error);
    res.status(500).json({ message: 'Server error fetching stories' });
  }
};

const createStory = async (req, res) => {
  try {
    const { status, media, type, category, mentions, visibility } = req.body;
    if (!status) return res.status(400).json({ message: 'Status message is required' });

    const story = await Story.create({
      user: req.user._id,
      type: type || 'text',
      category: category || 'study_progress',
      status,
      media: media || '',
      mentions: mentions || [],
      visibility: visibility || 'public',
      views: []
    });

    const populatedStory = await Story.findById(story._id).populate('user', 'fullName username avatar branch collegeName');
    
    const io = req.app.get('io');
    if (io) {
      io.emit('story_created', populatedStory);
    }

    res.status(201).json(populatedStory);
  } catch (error) {
    console.error('[createStory]', error);
    res.status(500).json({ message: 'Server error creating story' });
  }
};

const viewStory = async (req, res) => {
  try {
    const { id } = req.params;
    const story = await Story.findById(id);
    if (!story) return res.status(404).json({ message: 'Story not found' });

    if (!story.views.includes(req.user._id)) {
      story.views.push(req.user._id);
      await story.save();
      
      const io = req.app.get('io');
      if (io) {
        io.emit('story_viewed', { storyId: id, userId: req.user._id });
      }
    }

    res.json({ message: 'Story view tracked successfully', viewsCount: story.views.length });
  } catch (error) {
    console.error('[viewStory]', error);
    res.status(500).json({ message: 'Server error tracking story view' });
  }
};

const getStoryViewers = async (req, res) => {
  try {
    const { id } = req.params;
    const story = await Story.findById(id).populate('views', 'fullName username avatar branch collegeName');
    if (!story) return res.status(404).json({ message: 'Story not found' });

    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: only owner can view story statistics' });
    }

    res.json(story.views || []);
  } catch (error) {
    console.error('[getStoryViewers]', error);
    res.status(500).json({ message: 'Server error retrieving story viewers' });
  }
};

const deleteStory = async (req, res) => {
  try {
    const { id } = req.params;
    const story = await Story.findById(id);
    if (!story) return res.status(404).json({ message: 'Story not found' });

    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: you can only delete your own stories' });
    }

    await Story.findByIdAndDelete(id);

    const io = req.app.get('io');
    if (io) {
      io.emit('story_deleted', { storyId: id });
    }

    res.json({ message: 'Story deleted successfully', storyId: id });
  } catch (error) {
    console.error('[deleteStory]', error);
    res.status(500).json({ message: 'Server error deleting story' });
  }
};

const getDiscoverSuggestions = async (req, res) => {
  try {
    const excludeIds = [req.user._id, ...(req.user.friends || [])];
    
    // Suggested Students
    const suggestedStudents = await User.find({
      _id: { $nin: excludeIds },
      username: { $exists: true, $ne: '' }
    }).limit(10).select('fullName username avatar collegeName branch semester');

    // Suggested Groups
    const suggestedGroups = await Group.find({
      members: { $ne: req.user._id }
    }).limit(10).select('name description type members inviteCode');

    // Trending Notes
    const trendingNotes = await Post.find({
      type: 'notes'
    }).sort({ likes: -1 }).limit(5).select('title fileName fileUrl tag author').populate('author', 'fullName username avatar');

    // Trending Colleges
    const trendingColleges = await User.distinct('collegeName', { collegeName: { $exists: true, $ne: '' } });

    res.json({
      suggestedStudents,
      suggestedGroups: suggestedGroups.map(g => ({
        _id: g._id,
        name: g.name,
        description: g.description,
        type: g.type,
        membersCount: g.members.length,
        inviteCode: g.inviteCode
      })),
      trendingNotes,
      trendingColleges: trendingColleges.slice(0, 5)
    });
  } catch (error) {
    console.error('[discoverSuggestions]', error);
    res.status(500).json({ message: 'Server error fetching discover suggestions' });
  }
};

module.exports = {
  getFriends,
  searchFriendByMobile,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getGroups,
  createGroup,
  joinGroup,
  getGroupPreview,
  getChats,
  getMessages,
  getCalls,
  blockUser,
  reportUser,
  leaveGroup,
  getPosts,
  createPost,
  likePost,
  commentPost,
  getStories,
  createStory,
  viewStory,
  getStoryViewers,
  deleteStory,
  getDiscoverSuggestions
};
