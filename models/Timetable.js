const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema({
  periodNumber: { type: Number },
  timeSlot:     { type: String, required: true }, // e.g. "09:00-10:00"
  startTime:    { type: String }, // "09:00" or "09:00 AM"
  endTime:      { type: String }, // "10:00" or "10:00 AM"
  displayTime:  { type: String, default: '' }, // e.g. "09:00 AM - 10:00 AM"
  subjects:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  subjectCode:  { type: String, default: '' }, // e.g. "23EC501"
  subjectName:  { type: String, default: '' }, // e.g. "Digital Signal Processing"
  facultyId:    { type: String, default: '' },
  facultyName:  { type: String, default: '' },
  room:         { type: String, default: '' },
  type:         { type: String, enum: ['Theory', 'Lab', 'Seminar', 'Workshop', 'Break', 'Club', 'Holiday'], default: 'Theory' },
  label:        { type: String, default: '' }
});

const TimetableSchema = new mongoose.Schema(
  {
    department:    { type: String, required: true, uppercase: true, trim: true },
    academicYear:  { type: String, required: true, uppercase: true, trim: true }, // e.g. "2026-27"
    semester:      { type: Number, required: true }, // 1-8
    year:          { type: Number, required: true }, // 1-4
    section:       { type: String, required: true, uppercase: true, trim: true },
    day:           { 
      type: String, 
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], 
      required: true 
    },
    effectiveDate: { type: Date, default: Date.now },
    slots:          [SlotSchema],
    collegeCode:    { type: String, required: true, uppercase: true, trim: true },
    isApproved:     { type: Boolean, default: true },
    version:        { type: Number, default: 1 },
    createdBy:      { type: String, default: 'HOD System' },
    updatedBy:      { type: String, default: 'HOD System' },
    previousVersions: [
      {
        version: Number,
        slots: [SlotSchema],
        updatedAt: { type: Date, default: Date.now },
        updatedBy: String
      }
    ]
  },
  { timestamps: true }
);

TimetableSchema.index({ department: 1, academicYear: 1, semester: 1, section: 1, day: 1, collegeCode: 1 }, { unique: true });

module.exports = mongoose.models.Timetable || mongoose.model('Timetable', TimetableSchema);
