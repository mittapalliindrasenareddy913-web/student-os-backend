const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true },
  message:     { type: String, default: '' },
  type:        {
    type: String,
    enum: [
      'reminder', 'system', 'achievement', 'alert',
      'friend_request', 'friend_accepted',
      'message', 'missed_call', 'call',
      'group_invite', 'group_message',
      'shared_note', 'shared_pdf',
      'attendance', 'timetable', 'assignment', 'quiz', 'marks', 'exam', 'fee', 'library', 'hostel', 'transport', 'placement'
    ],
    default: 'system'
  },
  priority:    { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  isArchived:  { type: Boolean, default: false },
  isRead:      { type: Boolean, default: false },
  link:        { type: String, default: '' },
  icon:        { type: String, default: '' },
  // Community-related fields
  senderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  senderName:  { type: String, default: '' },
  senderAvatar:{ type: String, default: '' },
  relatedId:   { type: String, default: '' }, // e.g. chatRoomId, callId, groupId
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
