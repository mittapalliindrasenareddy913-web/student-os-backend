const mongoose = require('mongoose');

const RevaluationRequestSchema = new mongoose.Schema(
  {
    studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subjectCode: { type: String, required: true, uppercase: true, trim: true },
    semester:    { type: Number, required: true },
    examType:    { type: String, enum: ['mid_1', 'mid_2', 'semester', 'supplementary'], default: 'semester' },
    type:        { type: String, enum: ['revaluation', 'recounting', 'supplementary'], default: 'revaluation' },
    status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    amountPaid:  { type: Number, default: 0 },
    remarks:     { type: String, default: '' },
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.RevaluationRequest || mongoose.model('RevaluationRequest', RevaluationRequestSchema);
