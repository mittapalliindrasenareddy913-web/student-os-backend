const mongoose = require('mongoose');

const NoticeSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    content:     { type: String, required: true },
    type:        { 
      type: String, 
      enum: ['general', 'circular', 'emergency', 'holiday', 'academic', 'department', 'placement', 'exam', 'fee', 'library', 'hostel', 'transport'], 
      default: 'general' 
    },
    targetRoles:      [{ type: String }], // 'student', 'faculty', 'hod'
    targetDepartment: { type: String, default: '' },
    targetYear:       { type: String, default: '' },
    targetSection:    { type: String, default: '' },
    collegeCode:      { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Notice || mongoose.model('Notice', NoticeSchema);
