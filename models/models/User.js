const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    fullName:     { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:     { type: String, required: true },
    countryCode:  { type: String, default: '+91' },
    mobileNumber: { type: String, sparse: true, unique: true, trim: true }, // sparse allows null/missing to be ignored by unique index
    avatar:       { type: String, default: '' },
    profileVisibility: { type: String, enum: ['public', 'private'], default: 'private' },

    // Academic profile
    collegeName:  { type: String, default: '' },
    branch:       { type: String, default: '' },
    year:         { type: Number, min: 1, max: 5 },
    semester:     { type: Number, min: 1, max: 10 },
    rollNumber:   { type: String, default: '' },

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
    friendRequests: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    fcmTokens: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
