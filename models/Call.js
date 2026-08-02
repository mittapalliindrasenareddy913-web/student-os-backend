const mongoose = require('mongoose');

const CallSchema = new mongoose.Schema(
  {
    caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['missed', 'completed', 'rejected'], required: true },
    duration: { type: Number, default: 0 }, // Duration in seconds
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Call', CallSchema);
