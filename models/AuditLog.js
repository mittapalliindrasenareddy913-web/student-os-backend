const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    role:        { type: String, required: true }, // 'coe', 'student', 'faculty', etc.
    collegeCode: { type: String, default: '' },
    department:  { type: String, default: '' },
    action:      { type: String, required: true },
    device:      { type: String, default: '' },
    ipAddress:   { type: String, default: '' },
    oldValues:   { type: mongoose.Schema.Types.Mixed, default: null },
    newValues:   { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: { createdAt: 'timestamp', updatedAt: false } }
);

// Enforce permanent immutability
const preventMutation = function(next) {
  next(new Error('Audit logs are permanent and cannot be modified or deleted.'));
};

AuditLogSchema.pre('updateOne', preventMutation);
AuditLogSchema.pre('updateMany', preventMutation);
AuditLogSchema.pre('findOneAndUpdate', preventMutation);
AuditLogSchema.pre('deleteOne', preventMutation);
AuditLogSchema.pre('deleteMany', preventMutation);
AuditLogSchema.pre('findOneAndDelete', preventMutation);
AuditLogSchema.pre('remove', preventMutation);

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

