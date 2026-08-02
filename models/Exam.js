const mongoose = require('mongoose');

const ExamSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true }, // e.g. Semester End, Midterm 1
    type:        { type: String, enum: ['internal', 'external'], default: 'internal' },
    examType:    { type: String, enum: ['mid_1', 'mid_2', 'internal', 'external', 'practical', 'lab', 'supplementary'], default: 'external' },
    regulation:  { type: String, default: 'R22' },
    semester:    { type: Number, required: true },
    startDate:   { type: Date, required: true },
    status:      { type: String, enum: ['draft', 'published'], default: 'draft' },
    published:   { type: Boolean, default: false },
    timetable: [
      {
        date:        { type: Date, required: true },
        subjectCode: { type: String, required: true, uppercase: true, trim: true },
        session:     { type: String, enum: ['forenoon', 'afternoon'], default: 'forenoon' }
      }
    ],
    seatingArrangement: [
      {
        room:     { type: String, required: true },
        students: [{ type: String }] // Roll Numbers array
      }
    ],
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Exam || mongoose.model('Exam', ExamSchema);
