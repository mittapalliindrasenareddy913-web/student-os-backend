const mongoose = require('mongoose');

const FocusSessionSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  durationMin: { type: Number, required: true },       // planned minutes
  actualMin:   { type: Number, default: 0 },           // actually spent
  mode:        { type: String, enum: ['pomodoro', 'custom', 'flow'], default: 'pomodoro' },
  subject:     { type: String, default: '' },
  ambientSound:{ type: String, default: 'none' },
  completedAt: { type: Date },
  isCompleted: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('FocusSession', FocusSessionSchema);
