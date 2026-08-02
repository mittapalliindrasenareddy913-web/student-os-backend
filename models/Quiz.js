const mongoose = require('mongoose');

const QuizSchema = new mongoose.Schema(
  {
    title:        { type: String, required: true, trim: true },
    subjectCode:  { type: String, required: true, uppercase: true, trim: true },
    duration:     { type: Number, required: true }, // e.g. 30 (minutes)
    negativeMarks:{ type: Number, default: 0 },
    questions: [
      {
        text:         { type: String, required: true },
        options:      [{ type: String, required: true }],
        correctIndex: { type: Number, required: true },
        points:       { type: Number, default: 1 }
      }
    ],
    collegeCode:  { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Quiz || mongoose.model('Quiz', QuizSchema);
