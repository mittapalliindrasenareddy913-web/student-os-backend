const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema(
  {
    token:     { type: String, required: true, unique: true },
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

// Auto-delete tokens when expired
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.RefreshToken || mongoose.model('RefreshToken', RefreshTokenSchema);
