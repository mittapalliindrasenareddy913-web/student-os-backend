const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema({
  url:  { type: String, required: true },
  type: { type: String, enum: ['pdf', 'image', 'audio', 'other'], default: 'other' },
  name: { type: String, required: true }
}, { _id: true });

const NoteSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:     { type: String, required: true, trim: true },
  content:   { type: String, default: '' }, // HTML rich text
  
  subject:   { type: String, default: 'General' }, 
  folder:    { type: String, enum: ['Notes', 'PDFs', 'Assignments', 'AI Doubts', 'Important Questions'], default: 'Notes' },
  
  category:  { type: String, default: 'General' }, // Legacy backward compatibility
  tags:      [{ type: String }],
  color:     { type: String, default: '#8b5cf6' },
  isPinned:  { type: Boolean, default: false },
  isFav:     { type: Boolean, default: false },

  attachments: [AttachmentSchema]
}, { timestamps: true });

NoteSchema.index({ user: 1, title: 'text', content: 'text' });

module.exports = mongoose.model('Note', NoteSchema);
