const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const GroupMessage = require('../models/GroupMessage');
const GroupCategory = require('../models/GroupCategory');
const User = require('../models/User');

// Generate random invite code helper
const generateInviteCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

// GET /api/community/groups
const getGroups = async (req, res) => {
  try {
    const memberships = await GroupMember.find({ user: req.user._id })
      .populate({
        path: 'group',
        select: 'name description avatar category college branch year privacy inviteCode owner admin members'
      })
      .lean();

    const groups = memberships
      .filter(m => m.group)
      .map(m => ({
        ...m.group,
        role: m.role,
        isMuted: m.isMuted,
        isPinned: m.isPinned,
        memberCount: m.group.members ? m.group.members.length : 1
      }));

    res.json(groups);
  } catch (error) {
    console.error('[getGroups]', error);
    res.status(500).json({ message: 'Server error fetching groups' });
  }
};

// POST /api/community/groups
const createGroup = async (req, res) => {
  try {
    const { name, description, avatar, categoryId, college, branch, year, privacy, memberIds } = req.body;
    if (!name) return res.status(400).json({ message: 'Group name is required' });
    if (!categoryId) return res.status(400).json({ message: 'Category selection is mandatory' });

    const groupCategoryDoc = await GroupCategory.findById(categoryId);
    if (!groupCategoryDoc) return res.status(400).json({ message: 'Invalid category selection' });

    const inviteCode = generateInviteCode();
    const group = await Group.create({
      name,
      description,
      avatar: avatar || '',
      category: groupCategoryDoc.name,
      categoryId: groupCategoryDoc._id,
      createdBy: req.user._id,
      college: college || '',
      branch: branch || '',
      year: year || '',
      privacy: privacy || 'public',
      admin: req.user._id, // compatibility field
      members: [req.user._id, ...(memberIds || [])], // compatibility field
      inviteCode,
      owner: req.user._id
    });

    // Create GroupMember record for the owner
    await GroupMember.create({
      group: group._id,
      user: req.user._id,
      role: 'owner'
    });

    // Create GroupMember records for all other selected members
    if (memberIds && memberIds.length > 0) {
      const memberDocs = memberIds.map(uid => ({
        group: group._id,
        user: uid,
        role: 'member'
      }));
      await GroupMember.insertMany(memberDocs);
    }

    res.status(201).json(group);
  } catch (error) {
    console.error('[createGroup]', error);
    res.status(500).json({ message: 'Server error creating group' });
  }
};

// PUT /api/community/groups/:id
const editGroup = async (req, res) => {
  try {
    const { name, description, avatar, category, college, branch, year, privacy } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Verify requester has owner or admin role
    const member = await GroupMember.findOne({ group: group._id, user: req.user._id });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ message: 'Only owners or admins can edit group details' });
    }

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (avatar !== undefined) group.avatar = avatar;
    if (category) group.category = category;
    if (college !== undefined) group.college = college;
    if (branch !== undefined) group.branch = branch;
    if (year !== undefined) group.year = year;
    if (privacy) {
      group.privacy = privacy;
      group.type = privacy; // keep type compatibility field in sync
    }

    await group.save();
    res.json(group);
  } catch (error) {
    console.error('[editGroup]', error);
    res.status(500).json({ message: 'Server error editing group' });
  }
};

// DELETE /api/community/groups/:id
const deleteGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Verify requester is the owner
    const member = await GroupMember.findOne({ group: group._id, user: req.user._id });
    if (!member || member.role !== 'owner') {
      return res.status(403).json({ message: 'Only the group owner can delete this group' });
    }

    await Group.findByIdAndDelete(group._id);
    await GroupMember.deleteMany({ group: group._id });
    await GroupMessage.deleteMany({ group: group._id });

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('[deleteGroup]', error);
    res.status(500).json({ message: 'Server error deleting group' });
  }
};

// POST /api/community/groups/:id/members
const addMembers = async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !userIds.length) return res.status(400).json({ message: 'No users specified' });

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Verify admin/owner permission
    const requester = await GroupMember.findOne({ group: group._id, user: req.user._id });
    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      return res.status(403).json({ message: 'Only owners or admins can add members' });
    }

    const added = [];
    for (const uid of userIds) {
      const exists = await GroupMember.findOne({ group: group._id, user: uid });
      if (!exists) {
        await GroupMember.create({ group: group._id, user: uid, role: 'member' });
        group.members.push(uid);
        added.push(uid);
      }
    }
    await group.save();

    res.json({ message: 'Members added successfully', added });
  } catch (error) {
    console.error('[addMembers]', error);
    res.status(500).json({ message: 'Server error adding members' });
  }
};

// DELETE /api/community/groups/:id/members/:userId
const removeMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Verify requester permission
    const requester = await GroupMember.findOne({ group: group._id, user: req.user._id });
    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      return res.status(403).json({ message: 'Only owners or admins can remove members' });
    }

    // Verify target to remove is not the owner
    const target = await GroupMember.findOne({ group: group._id, user: userId });
    if (!target) return res.status(404).json({ message: 'Member not found' });
    if (target.role === 'owner') return res.status(400).json({ message: 'Cannot remove the group owner' });

    await GroupMember.findByIdAndDelete(target._id);
    group.members = group.members.filter(m => m.toString() !== userId.toString());
    await group.save();

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('[removeMember]', error);
    res.status(500).json({ message: 'Server error removing member' });
  }
};

// DELETE /api/community/groups/:id/leave
const leaveGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const member = await GroupMember.findOne({ group: group._id, user: req.user._id });
    if (!member) return res.status(400).json({ message: 'You are not a member of this group' });

    if (member.role === 'owner') {
      return res.status(400).json({ message: 'Please transfer ownership before leaving the group' });
    }

    await GroupMember.findByIdAndDelete(member._id);
    group.members = group.members.filter(m => m.toString() !== req.user._id.toString());
    await group.save();

    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('[leaveGroup]', error);
    res.status(500).json({ message: 'Server error leaving group' });
  }
};

// POST /api/community/groups/:id/transfer-ownership
const transferOwnership = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ message: 'Target user is required' });

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Verify current owner
    const requester = await GroupMember.findOne({ group: group._id, user: req.user._id });
    if (!requester || requester.role !== 'owner') {
      return res.status(403).json({ message: 'Only the group owner can transfer ownership' });
    }

    const target = await GroupMember.findOne({ group: group._id, user: targetUserId });
    if (!target) return res.status(400).json({ message: 'Target user is not a member of this group' });

    requester.role = 'admin';
    target.role = 'owner';
    await requester.save();
    await target.save();

    group.owner = targetUserId;
    group.admin = targetUserId; // compatibility sync
    await group.save();

    res.json({ message: 'Ownership transferred successfully' });
  } catch (error) {
    console.error('[transferOwnership]', error);
    res.status(500).json({ message: 'Server error transferring ownership' });
  }
};

// POST /api/community/groups/:id/mute
const toggleMute = async (req, res) => {
  try {
    const member = await GroupMember.findOne({ group: req.params.id, user: req.user._id });
    if (!member) return res.status(400).json({ message: 'Not a member of this group' });

    member.isMuted = !member.isMuted;
    await member.save();

    res.json({ message: member.isMuted ? 'Group muted' : 'Group unmuted', isMuted: member.isMuted });
  } catch (error) {
    console.error('[toggleMute]', error);
    res.status(500).json({ message: 'Server error muting group' });
  }
};

// POST /api/community/groups/:id/pin
const togglePin = async (req, res) => {
  try {
    const member = await GroupMember.findOne({ group: req.params.id, user: req.user._id });
    if (!member) return res.status(400).json({ message: 'Not a member of this group' });

    member.isPinned = !member.isPinned;
    await member.save();

    res.json({ message: member.isPinned ? 'Group pinned' : 'Group unpinned', isPinned: member.isPinned });
  } catch (error) {
    console.error('[togglePin]', error);
    res.status(500).json({ message: 'Server error pinning group' });
  }
};

// GET /api/community/groups/:id/messages/search
const searchMessages = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Search query is required' });

    const group = await Group.findById(req.params.id);
    if (!group || !group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to view messages' });
    }

    const matches = await GroupMessage.find({
      group: req.params.id,
      content: { $regex: q, $options: 'i' }
    })
    .populate('sender', 'fullName avatar')
    .sort({ createdAt: -1 });

    res.json(matches);
  } catch (error) {
    console.error('[searchMessages]', error);
    res.status(500).json({ message: 'Server error searching messages' });
  }
};

// GET /api/community/groups/:id/members
const getGroupMembers = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group || !group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to view members' });
    }

    const members = await GroupMember.find({ group: req.params.id })
      .populate('user', 'fullName username avatar branch collegeName')
      .lean();

    res.json(members);
  } catch (error) {
    console.error('[getGroupMembers]', error);
    res.status(500).json({ message: 'Server error fetching members' });
  }
};

// POST /api/community/groups/:id/messages/seen
const markMessagesSeen = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group || !group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Add user to seenBy array of all messages where they aren't already included
    await GroupMessage.updateMany(
      { group: req.params.id, seenBy: { $ne: req.user._id } },
      { $addToSet: { seenBy: req.user._id } }
    );

    res.json({ message: 'All messages marked as seen' });
  } catch (error) {
    console.error('[markMessagesSeen]', error);
    res.status(500).json({ message: 'Server error marking messages seen' });
  }
};

// GET /api/community/group-categories
const getGroupCategories = async (req, res) => {
  try {
    const categories = await GroupCategory.find({}).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    console.error('[getGroupCategories]', error);
    res.status(500).json({ message: 'Server error fetching categories' });
  }
};

// POST /api/community/group-categories
const createGroupCategory = async (req, res) => {
  try {
    const { name, icon, description, code } = req.body;
    if (!name || !code) return res.status(400).json({ message: 'Name and Code are required' });

    const exists = await GroupCategory.findOne({ code: code.trim().toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Category code already exists' });

    const category = await GroupCategory.create({
      name: name.trim(),
      icon: icon || '📚',
      description: description || '',
      code: code.trim().toLowerCase()
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('[createGroupCategory]', error);
    res.status(500).json({ message: 'Server error creating category' });
  }
};

// GET /api/community/groups/discover
const discoverGroups = async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};

    if (category && category !== 'all') {
      const catDoc = await GroupCategory.findOne({ code: category });
      if (catDoc) {
        query.categoryId = catDoc._id;
      }
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { college: searchRegex },
        { branch: searchRegex },
        { year: searchRegex }
      ];
    }

    const groups = await Group.find(query)
      .populate('owner', 'fullName avatar')
      .populate('categoryId', 'name icon code')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = groups.map(g => ({
      ...g,
      memberCount: g.members ? g.members.length : 0,
      isMember: g.members ? g.members.some(uid => uid.toString() === req.user._id.toString()) : false
    }));

    res.json(formatted);
  } catch (error) {
    console.error('[discoverGroups]', error);
    res.status(500).json({ message: 'Server error discovering groups' });
  }
};

module.exports = {
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
};
