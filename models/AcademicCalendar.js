const mongoose = require('mongoose');

const AcademicCalendarSchema = new mongoose.Schema(
  {
    date:        { type: Date, required: true },
    type:        { 
      type: String, 
      enum: ['working_day', 'holiday', 'exam', 'event', 'deadline', 'placement_drive'], 
      default: 'working_day' 
    },
    description: { type: String, default: '' },
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

// Enforce unique calendar dates within the same college
AcademicCalendarSchema.index({ date: 1, collegeCode: 1 }, { unique: true });

module.exports = mongoose.models.AcademicCalendar || mongoose.model('AcademicCalendar', AcademicCalendarSchema);
