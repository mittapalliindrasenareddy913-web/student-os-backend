const mongoose = require('mongoose');

const LeaveRequestSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startDate:   { type: Date, required: true },
    endDate:     { type: Date, required: true },
    reason:      { type: String, required: true },
    status:      { 
      type: String, 
      enum: ['pending', 'recommended', 'rejected', 'approved'], 
      default: 'pending' 
    },
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', LeaveRequestSchema);
