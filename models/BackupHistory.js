const mongoose = require('mongoose');

const BackupHistorySchema = new mongoose.Schema(
  {
    backupName:  { type: String, required: true },
    backupType:  { type: String, enum: ['manual', 'scheduled'], default: 'manual' },
    size:        { type: String, default: '0 KB' },
    status:      { type: String, enum: ['success', 'failed'], default: 'success' },
    verified:    { type: Boolean, default: true },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.models.BackupHistory || mongoose.model('BackupHistory', BackupHistorySchema);
