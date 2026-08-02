const mongoose = require('mongoose');

const SubjectFolderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true }
}, { timestamps: true });

SubjectFolderSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SubjectFolder', SubjectFolderSchema);
