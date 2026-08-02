const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema(
  {
    title:         { type: String, required: true, trim: true },
    description:   { type: String, default: '' },
    attachmentUrl: { type: String, default: '' },
    deadline:      { type: Date, required: true },
    subjectCode:   { type: String, required: true, uppercase: true, trim: true },
    class: {
      year:    { type: Number, required: true },
      section: { type: String, required: true, uppercase: true }
    },
    submissions: [
      {
        studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        submissionUrl: { type: String, default: '' },
        submittedAt:   { type: Date, default: Date.now },
        grade:         { type: String, default: '' } // e.g. 'A+', 'B'
      }
    ],
    collegeCode:   { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);
