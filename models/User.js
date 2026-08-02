const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    fullName:     { type: String, default: '', trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:     { type: String, required: true },
    username:     { type: String, unique: true, lowercase: true, trim: true, sparse: true },
    studentId:    { type: String, unique: true, trim: true, sparse: true },
    role:         { type: String, enum: ['student', 'principal', 'hod', 'faculty', 'super_admin', 'coe', 'exam_cell', 'accounts', 'library', 'placement', 'hostel', 'transport', 'hr', 'admission_office', 'parent', 'recruiter'], default: 'student' },
    linkedChildren: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    collegeCode:  { type: String, default: '', index: true },
    employeeId:   { type: String, default: null, sparse: true, trim: true },
    assignedDepartment: { type: String, default: '' },
    assignedClasses: [{
      year:    { type: Number },
      section: { type: String },
      subject: { type: String }
    }],
    faceVerificationData: { type: Object, default: null },
    isActive:     { type: Boolean, default: true },
    status:       { type: String, enum: ['ACTIVE', 'PRE_REGISTERED', 'DISABLED'], default: 'ACTIVE' },
    mustChangePassword: { type: Boolean, default: false },
    countryCode:  { type: String, default: '+91' },
    mobileNumber: { type: String, sparse: true, unique: true, trim: true }, 
    avatar:       { type: String, default: '' },
    coverPhoto:   { type: String, default: '' },
    bio:          { type: String, default: '' },
    dateOfBirth:  { type: Date, default: null },
    gender:       { type: String, enum: ['Male', 'Female', 'Prefer Not To Say'], default: 'Prefer Not To Say' },
    showGender:   { type: Boolean, default: false },

    // Academic profile
    collegeName:  { type: String, default: '' },
    branch:       { type: String, default: '' },
    year:         { type: Number, min: 1, max: 5 },
    semester:     { type: Number, min: 1, max: 10 },
    rollNumber:   { type: String, default: '' },
    section:      { type: String, default: '' },
    isCollegeConnected: { type: Boolean, default: false },
    collegeLinked:      { type: Boolean, default: false },
    firstLogin:         { type: Boolean, default: true },
    passwordLastChanged: { type: Date, default: null },
    // Account & Profile Custom Types
    accountType:    { type: String, enum: ['student', 'teacher', 'professor', 'job_seeker', 'professional', 'private', 'college'], default: 'private' },
    educationLevel: { type: String, default: '' },
    institution:    { type: String, default: '' },
    department:     { type: String, default: '' },
    subjectsTeaching: { type: String, default: '' },
    experienceYears: { type: Number, default: 0 },
    qualification:  { type: String, default: '' },
    jobStatus:      { type: String, default: '' },
    resumeUrl:      { type: String, default: '' },
    preferredJobRole: { type: String, default: '' },
    preferredLocation: { type: String, default: '' },
    openToWork:     { type: Boolean, default: false },
    country:        { type: String, default: '' },
    state:          { type: String, default: '' },
    city:           { type: String, default: '' },
    language:       { type: String, default: 'English' },
    timezone:       { type: String, default: '' },
    universityBoard: { type: String, default: '' },
    cgpaPercentage: { type: String, default: '' },
    officeLocation: { type: String, default: '' },
    researchArea:   { type: String, default: '' },
    publications:   { type: String, default: '' },
    highestQualification: { type: String, default: '' },
    expectedSalary: { type: String, default: '' },
    companyName:    { type: String, default: '' },
    jobTitle:       { type: String, default: '' },
    industry:       { type: String, default: '' },
    openToMentor:   { type: Boolean, default: false },

    skills:       [{ type: String, trim: true }],
    interests:    [{ type: String, trim: true }],
    location:     { type: String, default: '' },

    // Professional & Social Links
    githubUrl:    { type: String, default: '', trim: true },
    linkedinUrl:  { type: String, default: '', trim: true },
    portfolioUrl: { type: String, default: '', trim: true },
    websiteUrl:   { type: String, default: '', trim: true },
    instagramUrl: { type: String, default: '', trim: true },
    xUrl:         { type: String, default: '', trim: true },
    youtubeUrl:   { type: String, default: '', trim: true },
    telegramUrl:  { type: String, default: '', trim: true },

    // Visibility controls for links & contact info
    visibilitySettings: {
      email:        { type: String, enum: ['public', 'followers', 'private'], default: 'public' },
      mobileNumber: { type: String, enum: ['public', 'followers', 'private'], default: 'followers' },
      location:     { type: String, enum: ['public', 'followers', 'private'], default: 'public' },
      githubUrl:    { type: String, enum: ['public', 'followers', 'private'], default: 'public' },
      linkedinUrl:  { type: String, enum: ['public', 'followers', 'private'], default: 'public' },
      portfolioUrl: { type: String, enum: ['public', 'followers', 'private'], default: 'public' },
      websiteUrl:   { type: String, enum: ['public', 'followers', 'private'], default: 'public' },
      instagramUrl: { type: String, enum: ['public', 'followers', 'private'], default: 'public' },
      xUrl:         { type: String, enum: ['public', 'followers', 'private'], default: 'public' },
      youtubeUrl:   { type: String, enum: ['public', 'followers', 'private'], default: 'public' },
      telegramUrl:  { type: String, enum: ['public', 'followers', 'private'], default: 'public' }
    },

    profileVisibility: { type: String, enum: ['public', 'friends_only', 'private'], default: 'friends_only' },

    openToOpportunities: {
      internships:          { type: Boolean, default: false },
      teamMembers:          { type: Boolean, default: false },
      hackathons:           { type: Boolean, default: false },
      freelance:            { type: Boolean, default: false },
      mentoring:            { type: Boolean, default: false },
      projectCollaborators: { type: Boolean, default: false },
      studyPartners:        { type: Boolean, default: false },
      placementGroups:      { type: Boolean, default: false },
      custom:               [{ type: String, trim: true }]
    },

    // Gamification
    studyStreak:  { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
    totalFocusMinutes: { type: Number, default: 0 },

    // Dashboard summary cache (updated when modules save data)
    dashboardCache: {
      attendancePercent: { type: Number, default: 0 },
      tasksPending:      { type: Number, default: 0 },
      tasksCompleted:    { type: Number, default: 0 },
      classesToday:      { type: Number, default: 0 },
      examsNear:         { type: Number, default: 0 },
      focusMinutesToday: { type: Number, default: 0 },
    },

    settings: {
      notifications: { type: Boolean, default: true },
      darkMode:      { type: Boolean, default: true },
      language:      { type: String, default: 'en' },
    },

    // Password reset OTP
    resetOtp:        { type: String, default: null },
    resetOtpExpiry:  { type: Date,   default: null },
    otpRequestCount: { type: Number, default: 0 },
    otpRequestLockUntil: { type: Date, default: null },

    // Community & Communication
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friendRequests: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    fcmTokens: [{ type: String }],
    
    // Moderation
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reportedUsers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, enum: ['Spam', 'Abuse', 'Fake Account', 'Other'] },
        reportedAt: { type: Date, default: Date.now }
      }
    ],

    isGoogleLinked: { type: Boolean, default: false },
    googleId: { type: String, unique: true, sparse: true, trim: true },

    // Authentication
    refreshTokens: [{ type: String }],
  },
  { timestamps: true }
);

UserSchema.pre('save', async function() {
  if (!this.studentId) {
    try {
      const lastUser = await mongoose.model('User').findOne({ studentId: /^SOS-\d{6}$/ }).sort({ studentId: -1 });
      let nextNum = 1;
      if (lastUser && lastUser.studentId) {
        const parts = lastUser.studentId.split('-');
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) {
          nextNum = num + 1;
        }
      }
      this.studentId = `SOS-${String(nextNum).padStart(6, '0')}`;
    } catch (err) {
      console.error('Error generating studentId in pre-save hook:', err);
    }
  }
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
