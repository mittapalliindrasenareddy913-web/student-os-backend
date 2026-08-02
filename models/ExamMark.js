const mongoose = require('mongoose');

const ExamMarkSchema = new mongoose.Schema(
  {
    studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subjectCode: { type: String, required: true, uppercase: true, trim: true },
    marks:       { type: Number, required: true },
    maxMarks:    { type: Number, default: 100 },
    type:        { 
      type: String, 
      enum: ['mid_1', 'mid_2', 'external'], 
      default: 'mid_1' 
    },
    status:      { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending' 
    },
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.ExamMark || mongoose.model('ExamMark', ExamMarkSchema);
