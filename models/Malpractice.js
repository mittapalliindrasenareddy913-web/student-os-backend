const mongoose = require('mongoose');

const MalpracticeSchema = new mongoose.Schema(
  {
    caseNumber:  { type: String, default: '' },
    studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subjectCode: { type: String, required: true, uppercase: true, trim: true },
    examDate:    { type: Date, required: true },
    description: { type: String, default: '' },
    evidence:    { type: String, default: '' }, // URL or details
    decision:    { type: String, default: 'Pending' },
    penalty:     { type: String, default: '' },
    punishment:  { type: String, default: '' },
    remarks:     { type: String, default: '' },
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Malpractice || mongoose.model('Malpractice', MalpracticeSchema);
