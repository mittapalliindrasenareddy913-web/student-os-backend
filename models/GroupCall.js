const mongoose = require('mongoose');

const GroupCallSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    type: { type: String, enum: ['voice', 'video'], default: 'voice' },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('GroupCall', GroupCallSchema);
