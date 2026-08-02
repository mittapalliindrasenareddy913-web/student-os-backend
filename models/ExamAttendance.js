const mongoose = require('mongoose');

const ExamAttendanceSchema = new mongoose.Schema(
  {
    studentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    examScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSchedule', required: true },
    status:         { type: String, enum: ['Present', 'Absent', 'Malpractice', 'Late Entry'], default: 'Present' },
    remarks:        { type: String, default: '' },
    collegeCode:    { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.ExamAttendance || mongoose.model('ExamAttendance', ExamAttendanceSchema);
