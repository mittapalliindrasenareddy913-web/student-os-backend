const mongoose = require('mongoose');

const LoginSessionSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    device:    { type: String, default: '' },
    browser:   { type: String, default: '' },
    lastActive:{ type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.models.LoginSession || mongoose.model('LoginSession', LoginSessionSchema);
