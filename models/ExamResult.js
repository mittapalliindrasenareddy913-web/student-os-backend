const mongoose = require('mongoose');

const ExamResultSchema = new mongoose.Schema(
  {
    studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    semester:    { type: Number, required: true },
    sgpa:        { type: Number, required: true },
    cgpa:        { type: Number, required: true },
    passStatus:  { type: String, enum: ['Pass', 'Fail'], default: 'Pass' },
    status:      { type: String, enum: ['preview', 'published'], default: 'preview' },
    moderationApplied: { type: Boolean, default: false },
    graceMarksAdded:   { type: Number, default: 0 },
    graceSubjectCode:  { type: String, default: '' },
    subjectGrades: [
      {
        subjectCode:  { type: String, required: true, uppercase: true },
        internalMarks: { type: Number, default: 0 },
        externalMarks: { type: Number, default: 0 },
        totalMarks:    { type: Number, default: 0 },
        grade:         { type: String, required: true }, // e.g. 'A+', 'B'
        credits:       { type: Number, required: true }
      }
    ],
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.ExamResult || mongoose.model('ExamResult', ExamResultSchema);
