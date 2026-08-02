const mongoose = require('mongoose');

const CollegeSchema = new mongoose.Schema(
  {
    collegeCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name:        { type: String, required: true, trim: true },
    address:     { type: String, default: '' },
    university:  { type: String, default: '' },
    state:       { type: String, default: '' },
    district:    { type: String, default: '' },
    city:        { type: String, default: '' },
    logo:        { type: String, default: '' },
    departments: [{ type: String, trim: true }],
    
    // Directory Search and AISHE Parameters
    aisheCode:     { type: String, default: '' },
    collegeType:   { type: String, default: 'Private' }, // Private, Government, Autonomous
    aicteApproved: { type: Boolean, default: true },
    ugcApproved:   { type: Boolean, default: true },
    naacGrade:     { type: String, default: 'A' },
    nbaAccredited: { type: Boolean, default: false },
    verifiedBadge: { type: Boolean, default: false },

    // ERP configuration items
    courses:       [{ type: String, trim: true }],
    programs:      [{ type: String, trim: true }],
    branches:      [{ type: String, trim: true }],
    academicYears: [{ type: String, trim: true }],
    sections:      [{ type: String, trim: true }],
    semesters:     [{ type: String, trim: true }],
    regulations:   [{ type: String, trim: true }],

    // Extended Setup items
    workingDays:      [{ type: String, default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }],
    timings:          [{ type: String, default: ['09:00-10:00', '10:00-11:00', '11:15-12:15', '12:15-01:15', '02:00-03:00', '03:00-04:00'] }],
    holidays:         [{ date: Date, description: String }],
    gradingSystem:    [{ grade: String, points: Number }],
    attendanceRules:  {
      minPercentage:  { type: Number, default: 75 }
    },
    timezone:         { type: String, default: 'Asia/Kolkata' },
    language:         { type: String, default: 'en' },
    dateFormat:       { type: String, default: 'DD/MM/YYYY' },

    status:      { 
      type: String, 
      enum: ['verified', 'pending_verification', 'pending_activation', 'rejected', 'suspended', 'active'], 
      default: 'pending_verification' 
    },
    activatedAt: { type: Date, default: null },
    isDeleted:   { type: Boolean, default: false },
    
    // Enterprise SaaS Feature Controls
    features: {
      studentOs:   { type: Boolean, default: true },
      community:   { type: Boolean, default: true },
      attendance:  { type: Boolean, default: true },
      aiFeatures:  { type: Boolean, default: true },
      library:     { type: Boolean, default: true },
      hostel:      { type: Boolean, default: true },
      transport:   { type: Boolean, default: true },
      placement:   { type: Boolean, default: true },
      alumni:      { type: Boolean, default: true }
    },
    betaEnrollment: { type: Boolean, default: false },

    subscription: {
      plan:         { type: String, enum: ['Free Trial', 'Basic', 'Professional', 'Enterprise'], default: 'Free Trial' },
      startDate:    { type: Date, default: Date.now },
      expiryDate:   { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days default
      storageLimit: { type: Number, default: 5 * 1024 * 1024 * 1024 }, // 5GB default
      studentLimit: { type: Number, default: 1000 } // 1000 students default
    }
  },
  { timestamps: true }
);

// Optimize performance with single-field indexes for filtering
CollegeSchema.index({ name: 1 });
CollegeSchema.index({ city: 1 });
CollegeSchema.index({ district: 1 });
CollegeSchema.index({ state: 1 });
CollegeSchema.index({ university: 1 });
CollegeSchema.index({ collegeType: 1 });
CollegeSchema.index({ aisheCode: 1 });

module.exports = mongoose.models.College || mongoose.model('College', CollegeSchema);
