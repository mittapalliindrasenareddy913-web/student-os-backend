const mongoose = require('mongoose');

const LabRecordSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true }, // Student rollNumber
    studentName: { type: String, required: true },
    subjectCode: { type: String, required: true, uppercase: true },
    section: { type: String, required: true, uppercase: true },
    experimentNumber: { type: Number, required: true },
    experimentName: { type: String, required: true },
    submissionDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['Completed', 'Pending', 'Incomplete'], default: 'Completed' },
    observationMarks: { type: Number, default: 0 },
    vivaMarks: { type: Number, default: 0 },
    recordMarks: { type: Number, default: 0 },
    remarks: { type: String, default: '' },
    collegeCode: { type: String, required: true, uppercase: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.LabRecord || mongoose.model('LabRecord', LabRecordSchema);
