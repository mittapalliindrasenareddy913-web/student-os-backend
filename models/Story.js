const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video', 'text'],
    default: 'text'
  },
  category: {
    type: String,
    enum: ['certificates', 'hackathons', 'internships', 'projects', 'study_goals', 'study_progress', 'notes', 'college_events', 'placement_updates'],
    default: 'study_progress'
  },
  status: {
    type: String,
    required: true
  },
  media: String,
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  visibility: {
    type: String,
    enum: ['public', 'followers'],
    default: 'public'
  },
  views: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // expires in 24 hours
    index: { expireAfterSeconds: 0 } // automatic deletion by mongo
  }
}, { timestamps: true });

module.exports = mongoose.model('Story', StorySchema);
