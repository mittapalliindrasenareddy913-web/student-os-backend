const mongoose = require('mongoose');

const JobApplicationSchema = new mongoose.Schema(
  {
    driveId:   { type: mongoose.Schema.Types.ObjectId, ref: 'JobDrive', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:    { 
      type: String, 
      enum: ['Applied', 'Shortlisted', 'Interviewing', 'Offered', 'Rejected'], 
      default: 'Applied' 
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.JobApplication || mongoose.model('JobApplication', JobApplicationSchema);
