const mongoose = require('mongoose');

const studyMaterialSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject:     { type: String, required: true, trim: true },
  title:       { type: String, required: true, trim: true },
  type:        { type: String, enum: ['note', 'pdf', 'book', 'video', 'other'], default: 'note' },
  content:     { type: String, default: '' },       // text notes
  fileData:    { type: String, default: '' },       // base64 for small files
  fileName:    { type: String, default: '' },
  fileSize:    { type: Number, default: 0 },
  fileMime:    { type: String, default: '' },
  fileUrl:     { type: String, default: '' },       // external URL
  tags:        [{ type: String }],
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});

studyMaterialSchema.index({ userId: 1, subject: 1 });
studyMaterialSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('StudyMaterial', studyMaterialSchema);
