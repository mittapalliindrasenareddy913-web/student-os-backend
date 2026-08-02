const mongoose = require('mongoose');

const PlacementDriveSchema = new mongoose.Schema(
  {
    companyName:   { type: String, required: true, trim: true },
    role:          { type: String, required: true, trim: true },
    packageOffered:{ type: String, default: '' }, // e.g. '12 LPA'
    driveDate:     { type: Date, required: true },
    eligibilityCriteria: {
      cgpaCutoff:     { type: Number, default: 0 },
      activeBacklogs: { type: Number, default: 0 }
    },
    registrations: [
      {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status:    { type: String, enum: ['applied', 'shortlisted', 'selected', 'rejected'], default: 'applied' }
      }
    ],
    collegeCode:   { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.PlacementDrive || mongoose.model('PlacementDrive', PlacementDriveSchema);
