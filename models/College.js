const mongoose = require('mongoose');

const CollegeSchema = new mongoose.Schema(
  {
    institutionId: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    collegeCode:   { type: String, required: true, unique: true, uppercase: true, trim: true },
    name:          { type: String, required: true, trim: true },
    address:       { type: String, default: '' },
    university:    { type: String, default: '' },
    country:       { type: String, default: 'India' },
    state:         { type: String, default: '' },
    district:      { type: String, default: '' },
    city:          { type: String, default: '' },
    pincode:       { type: String, default: '' },
    officialEmail: { type: String, lowercase: true, trim: true, default: '' },
    officialPhone: { type: String, trim: true, default: '' },
    website:       { type: String, trim: true, default: '' },
    logo:          { type: String, default: '' },
    
    // Principal Contact
    principalName:  { type: String, default: '' },
    principalEmail: { type: String, lowercase: true, trim: true, default: '' },
    principalPhone: { type: String, trim: true, default: '' },

    // Limits & Resource Allocation
    maxStudents:    { type: Number, default: 1000 },
    maxFaculty:     { type: Number, default: 100 },
    maxDepartments: { type: Number, default: 10 },
    subscriptionPlan: { type: String, enum: ['Free Trial', 'Basic', 'Professional', 'Enterprise'], default: 'Professional' },

    departments:   [{ type: String, trim: true }],
    courses:       [{ type: String, trim: true }],
    programs:      [{ type: String, trim: true }],
    branches:      [{ type: String, trim: true }],
    academicYears: [{ type: String, trim: true }],
    sections:      [{ type: String, trim: true }],
    semesters:     [{ type: String, trim: true }],
    regulations:   [{ type: String, trim: true }],

    // Directory Search and Accreditation Parameters
    aisheCode:     { type: String, default: '' },
    collegeType:   { type: String, default: 'Private' },
    aicteApproved: { type: Boolean, default: true },
    ugcApproved:   { type: Boolean, default: true },
    naacGrade:     { type: String, default: 'A' },
    nbaAccredited: { type: Boolean, default: false },
    verifiedBadge: { type: Boolean, default: true },

    workingDays:   [{ type: String, default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }],
    timings:       [{ type: String, default: ['09:00-10:00', '10:00-11:00', '11:15-12:15', '12:15-01:15', '02:00-03:00', '03:00-04:00'] }],
    attendanceRules: {
      minPercentage: { type: Number, default: 75 }
    },
    timezone:      { type: String, default: 'Asia/Kolkata' },
    dateFormat:    { type: String, default: 'DD/MM/YYYY' },

    status: { 
      type: String, 
      enum: ['verified', 'pending_verification', 'pending_activation', 'rejected', 'suspended', 'active'], 
      default: 'active' 
    },
    activatedAt: { type: Date, default: Date.now },
    isDeleted:   { type: Boolean, default: false },
    
    // Enterprise SaaS Feature Controls
    features: {
      studentOs:  { type: Boolean, default: true },
      community:  { type: Boolean, default: true },
      attendance: { type: Boolean, default: true },
      aiFeatures: { type: Boolean, default: true },
      library:    { type: Boolean, default: true },
      hostel:     { type: Boolean, default: true },
      transport:  { type: Boolean, default: true },
      placement:  { type: Boolean, default: true },
      alumni:     { type: Boolean, default: true }
    },

    subscription: {
      plan:         { type: String, default: 'Professional' },
      startDate:    { type: Date, default: Date.now },
      expiryDate:   { type: Date, default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
      storageLimit: { type: Number, default: 50 * 1024 * 1024 * 1024 }, // 50GB
      studentLimit: { type: Number, default: 2000 }
    }
  },
  { timestamps: true }
);

CollegeSchema.index({ name: 1 });
CollegeSchema.index({ collegeCode: 1 });
CollegeSchema.index({ institutionId: 1 });
CollegeSchema.index({ status: 1 });
CollegeSchema.index({ state: 1 });

module.exports = mongoose.models.College || mongoose.model('College', CollegeSchema);
