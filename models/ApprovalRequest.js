const mongoose = require('mongoose');

const ApprovalRequestSchema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
      type: String, 
      enum: ['hod_request', 'department_request', 'certificate_request', 'policy_approval'], 
      required: true 
    },
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending' 
    },
    comments:    { type: String, default: '' },
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.ApprovalRequest || mongoose.model('ApprovalRequest', ApprovalRequestSchema);
