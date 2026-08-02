const mongoose = require('mongoose');

const CollegeRequestSchema = new mongoose.Schema(
  {
    collegeName:    { type: String, required: true, trim: true },
    aisheCode:      { type: String, trim: true },
    university:     { type: String, required: true, trim: true },
    state:          { type: String, required: true, trim: true },
    district:       { type: String, required: true, trim: true },
    city:           { type: String, required: true, trim: true },
    collegeType:    { type: String, default: 'Private' },
    website:        { type: String, trim: true },
    officialEmail:  { type: String, required: true, lowercase: true, trim: true },
    officialPhone:  { type: String, required: true, trim: true },
    address:        { type: String, required: true, trim: true },
    pincode:        { type: String, required: true, trim: true },
    principalName:  { type: String, required: true, trim: true },
    principalEmail: { type: String, required: true, lowercase: true, trim: true },
    documentUrl:    { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'changes_requested'],
      default: 'pending'
    },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.models.CollegeRequest || mongoose.model('CollegeRequest', CollegeRequestSchema);
