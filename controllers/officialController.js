const Message = require('../models/Message');
const User = require('../models/User');
const Group = require('../models/Group');
const { logAction } = require('../services/auditLogService');
const { sendFcmNotification } = require('../services/notificationService');

// =============================================================
// OFFICIAL CHATS & MESSAGES
// =============================================================
const getOfficialChats = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode;
    // Find unique conversational partners inside the same college
    const messages = await Message.find({
      collegeCode,
      isOfficial: true,
      $or: [{ sender: req.user._id }, { recipient: req.user._id }]
    })
    .populate('sender', 'fullName avatar role')
    .populate('recipient', 'fullName avatar role')
    .sort({ createdAt: -1 });

    const threadsMap = {};
    for (const m of messages) {
      const otherUser = m.sender._id.toString() === req.user._id.toString() ? m.recipient : m.sender;
      if (!threadsMap[otherUser._id]) {
        threadsMap[otherUser._id] = {
          user: otherUser,
          lastMessage: m.content,
          timestamp: m.createdAt
        };
      }
    }

    res.status(200).json(Object.values(threadsMap));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getOfficialMessages = async (req, res) => {
  try {
    const { recipientId } = req.params;
    const collegeCode = req.user.collegeCode;

    // Verify recipient belongs to the same collegeCode
    const recipient = await User.findById(recipientId);
    if (!recipient || recipient.collegeCode !== collegeCode) {
      return res.status(403).json({ message: 'Forbidden. Communication restricted to your college.' });
    }

    const messages = await Message.find({
      collegeCode,
      isOfficial: true,
      $or: [
        { sender: req.user._id, recipient: recipientId },
        { sender: recipientId, recipient: req.user._id }
      ]
    })
    .populate('sender', 'fullName avatar role')
    .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const sendOfficialMessage = async (req, res) => {
  try {
    const { recipientId, content, fileUrl, fileType, fileName } = req.body;
    const collegeCode = req.user.collegeCode;

    const recipient = await User.findById(recipientId);
    if (!recipient || recipient.collegeCode !== collegeCode) {
      return res.status(403).json({ message: 'Forbidden. Recipient belongs to another college.' });
    }

    const msg = await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      isGroup: false,
      content,
      fileUrl,
      fileType,
      fileName,
      isOfficial: true,
      collegeCode
    });

    const populated = await Message.findById(msg._id).populate('sender', 'fullName avatar role');

    // Socket.io emit
    const io = req.app.get('io');
    if (io) {
      io.to(recipientId.toString()).emit('receive_official_message', populated);
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// OFFICIAL GROUP & BROADCAST CHANNELS
// =============================================================
const createOfficialGroup = async (req, res) => {
  try {
    const { name, department, year, section } = req.body;
    const collegeCode = req.user.collegeCode;

    // Enforce only authorized staff roles can create official groups
    const authorized = ['principal', 'hod', 'coe', 'admin'].includes(req.user.role);
    if (!authorized) {
      return res.status(403).json({ message: 'Forbidden. Students cannot create official groups.' });
    }

    const group = await Group.create({
      name,
      collegeCode,
      isOfficial: true,
      createdBy: req.user._id,
      department,
      year,
      section
    });

    await logAction(req.user._id, req.user.role, collegeCode, '', `CREATED_OFFICIAL_GROUP: ${name}`, req);
    res.status(201).json({ message: 'Official group created successfully.', group });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const sendBroadcast = async (req, res) => {
  try {
    const { title, body, department, year, semester, section, targetRole } = req.body;
    const collegeCode = req.user.collegeCode;

    // Principal or HOD authorization
    if (!['principal', 'hod', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden. Unauthorized to publish broadcasts.' });
    }

    // If HOD, restrict broadcast to department only
    const deptFilter = req.user.role === 'hod' ? req.user.assignedDepartment : department;

    // Dispatch FCM triggers
    await sendFcmNotification({
      collegeCode,
      department: deptFilter,
      year,
      section,
      title: `📢 ${title}`,
      body
    });

    await logAction(req.user._id, req.user.role, collegeCode, '', `PUBLISHED_BROADCAST: ${title}`, req);
    res.status(200).json({ message: 'Official broadcast published successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getOfficialChats,
  getOfficialMessages,
  sendOfficialMessage,
  createOfficialGroup,
  sendBroadcast
};
