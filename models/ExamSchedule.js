const mongoose = require('mongoose');

const ExamScheduleSchema = new mongoose.Schema(
  {
    department:  { type: String, default: '' },
    semester:    { type: Number, required: true },
    section:     { type: String, default: 'A' },
    subjectName: { type: String, default: '' },
    subjectCode: { type: String, required: true, uppercase: true, trim: true },
    examDate:    { type: Date, required: true },
    timeSlot:    { type: String, required: true }, // e.g. "09:30-12:30"
    startTime:   { type: String, default: '09:30' },
    endTime:     { type: String, default: '12:30' },
    room:        { type: String, required: true },
    session:     { type: String, enum: ['forenoon', 'afternoon'], default: 'forenoon' },
    type:        { 
      type: String, 
      enum: ['mid_1', 'mid_2', 'semester', 'supplementary'], 
      default: 'semester' 
    },
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.ExamSchedule || mongoose.model('ExamSchedule', ExamScheduleSchema);
