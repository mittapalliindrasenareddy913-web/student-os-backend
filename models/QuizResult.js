const mongoose = require('mongoose');

const QuizResultSchema = new mongoose.Schema(
  {
    quizId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    answers:      [{ type: Number }], // Index matches question index
    score:        { type: Number, required: true },
    correctCount: { type: Number, required: true },
    collegeCode:  { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.QuizResult || mongoose.model('QuizResult', QuizResultSchema);
