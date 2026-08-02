const mongoose = require('mongoose');

const ClassDiarySchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    subjectCode: { type: String, required: true, uppercase: true },
    section: { type: String, required: true, uppercase: true },
    topicCovered: { type: String, required: true },
    homework: { type: String, default: '' },
    remarks: { type: String, default: '' },
    completionStatus: { type: String, enum: ['Completed', 'Partially Completed', 'Postponed'], default: 'Completed' },
    facultyId: { type: String, required: true },
    collegeCode: { type: String, required: true, uppercase: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.ClassDiary || mongoose.model('ClassDiary', ClassDiarySchema);
