const mongoose = require('mongoose');

const GroupMessageSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    
    // For attachments
    fileUrl: { type: String, default: null },
    fileType: { type: String, default: null }, // e.g. 'image', 'pdf', 'document', 'note', 'project'
    fileName: { type: String, default: null },

    // Advanced messaging features
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupMessage', default: null },
    forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    
    // Read status
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('GroupMessage', GroupMessageSchema);
