const mongoose = require('mongoose');

const PageNoteSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName:   { type: String, required: true },
  pageNumber: { type: Number, required: true },
  x:          { type: Number, required: true }, // PDF point X
  y:          { type: Number, required: true }, // PDF point Y
  content:    { type: String, default: '', trim: true }
}, { timestamps: true });

PageNoteSchema.index({ user: 1, fileName: 1 });

module.exports = mongoose.model('PageNote', PageNoteSchema);
