const mongoose = require('mongoose');

const BookmarkSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName:   { type: String, required: true },
  pageNumber: { type: Number, required: true },
  title:      { type: String, required: true, trim: true }
}, { timestamps: true });

BookmarkSchema.index({ user: 1, fileName: 1 });

module.exports = mongoose.model('Bookmark', BookmarkSchema);
