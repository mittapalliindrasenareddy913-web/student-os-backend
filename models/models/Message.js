const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    sender:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Either a User ID (for 1-on-1 chat) or a Group ID (for group chat)
    recipient:   { type: mongoose.Schema.Types.ObjectId, required: true },
    isGroup:     { type: Boolean, default: false },
    
    content:     { type: String, default: '' },
    
    // For attachments
    fileUrl:     { type: String, default: null },
    fileType:    { type: String, enum: ['image', 'pdf', 'document', 'other', null], default: null },
    fileName:    { type: String, default: null },

    // Metadata
    readBy:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isPinned:    { type: Boolean, default: false },
    isDeleted:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', MessageSchema);
