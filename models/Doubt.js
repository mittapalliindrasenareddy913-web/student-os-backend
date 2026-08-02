const mongoose = require('mongoose');

const DoubtSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentName: { type: String, required: true },
    subjectCode: { type: String, required: true, uppercase: true },
    question: { type: String, required: true },
    answer: { type: String, default: '' },
    status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
    facultyId: { type: String, required: true },
    collegeCode: { type: String, required: true, uppercase: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Doubt || mongoose.model('Doubt', DoubtSchema);
