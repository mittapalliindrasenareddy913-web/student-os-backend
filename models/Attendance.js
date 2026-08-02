const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    // ── Student identifiers ─────────────────────────────────────────────────
    studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rollNumber:   { type: String, default: '', uppercase: true, trim: true },

    // ── Class context ───────────────────────────────────────────────────────
    collegeCode:  { type: String, required: true, uppercase: true, trim: true },
    department:   { type: String, default: '', uppercase: true, trim: true },
    academicYear: { type: String, default: '' },   // e.g. "2025-26"
    semester:     { type: Number, default: 0 },
    section:      { type: String, default: '', uppercase: true, trim: true },
    year:         { type: Number, default: 0 },    // 1 / 2 / 3 / 4

    // ── Subject context ─────────────────────────────────────────────────────
    subjectCode:  { type: String, required: true, uppercase: true, trim: true },
    subjectName:  { type: String, default: '', trim: true },

    // ── Faculty context ─────────────────────────────────────────────────────
    facultyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    facultyName:  { type: String, default: '', trim: true },

    // ── Slot / Period ────────────────────────────────────────────────────────
    date:         { type: Date, required: true },
    timeSlot:     { type: String, default: '' },   // e.g. "09:00-10:00"
    period:       { type: Number, default: 0 },    // Period number within the day

    // ── Status ───────────────────────────────────────────────────────────────
    status:       {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'Medical'],
      default: 'Present'
    },
    remarks:      { type: String, default: '' }
  },
  { timestamps: true }
);

// ── Unique constraint ────────────────────────────────────────────────────────
// Prevent duplicate attendance for the same student in the same class slot.
AttendanceSchema.index(
  { studentId: 1, date: 1, timeSlot: 1, subjectCode: 1, collegeCode: 1 },
  { unique: true }
);

// ── HOD query indexes ────────────────────────────────────────────────────────
// Covers GET /hod/attendance?date=&section=&subjectCode=
AttendanceSchema.index({ collegeCode: 1, department: 1, date: 1, section: 1 });
// Covers analytics aggregations by subject / faculty
AttendanceSchema.index({ collegeCode: 1, department: 1, subjectCode: 1, date: 1 });
AttendanceSchema.index({ collegeCode: 1, department: 1, facultyId: 1, date: 1 });
// Covers history endpoint (date-range queries)
AttendanceSchema.index({ collegeCode: 1, department: 1, date: -1 });

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
