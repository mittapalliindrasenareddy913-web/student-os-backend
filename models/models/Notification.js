const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:   { type: String, required: true },
  message: { type: String, default: '' },
  type:    { type: String, enum: ['reminder','system','achievement','alert'], default: 'system' },
  isRead:  { type: Boolean, default: false },
  link:    { type: String, default: '' },
  icon:    { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
