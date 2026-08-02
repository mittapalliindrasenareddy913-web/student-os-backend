const mongoose = require('mongoose');

const SubtaskSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
}, { _id: true });

const TaskSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category:    { type: String, default: 'General' },
  subject:     { type: String, default: '' }, // For backward compatibility / linking
  priority:    { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  status:      { type: String, enum: ['todo', 'in-progress', 'completed'], default: 'todo' },
  
  dueDate:     { type: Date },
  completedAt: { type: Date },
  
  tags:        [{ type: String }],
  isPinned:    { type: Boolean, default: false },
  
  // Advanced features
  subtasks:    [SubtaskSchema],
  hasReminder: { type: Boolean, default: false },
  reminderTime:{ type: Date },
  recurrence:  { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
  color:       { type: String, default: '#8b5cf6' },

}, { timestamps: true });

// Virtual to calculate completion percentage based on subtasks
TaskSchema.virtual('progress').get(function () {
  if (this.status === 'completed') return 100;
  if (!this.subtasks || this.subtasks.length === 0) return this.status === 'in-progress' ? 50 : 0;
  
  const completedCount = this.subtasks.filter(st => st.isCompleted).length;
  return Math.round((completedCount / this.subtasks.length) * 100);
});

TaskSchema.set('toJSON', { virtuals: true });
TaskSchema.set('toObject', { virtuals: true });

// Indexes for performance
TaskSchema.index({ user: 1, status: 1 });
TaskSchema.index({ user: 1, dueDate: 1 });
TaskSchema.index({ user: 1, isPinned: -1, dueDate: 1 });

module.exports = mongoose.model('Task', TaskSchema);
