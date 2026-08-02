const mongoose = require('mongoose');

const JobDriveSchema = new mongoose.Schema(
  {
    title:           { type: String, required: true, trim: true },
    companyId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    role:            { type: String, required: true },
    jobType:         { type: String, default: 'Full-time' },
    packageAmount:   { type: String, required: true },
    minCgpa:         { type: Number, default: 6.0 },
    allowedBranches: [{ type: String }],
    status:          { 
      type: String, 
      enum: ['Open', 'Closed'], 
      default: 'Open' 
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.JobDrive || mongoose.model('JobDrive', JobDriveSchema);
