const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema(
  {
    subjectCode: { type: String, required: true, uppercase: true, trim: true },
    name:        { type: String, required: true, trim: true },
    faculty:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    credits:     { type: Number, default: 3 },
    department:  { type: String, required: true, uppercase: true, trim: true },
    semester:    { type: Number, required: true },
    type:        { type: String, enum: ['Theory', 'Lab', 'Elective'], default: 'Theory' },
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

// Unique code per college
SubjectSchema.index({ subjectCode: 1, collegeCode: 1 }, { unique: true });

module.exports = mongoose.models.Subject || mongoose.model('Subject', SubjectSchema);
