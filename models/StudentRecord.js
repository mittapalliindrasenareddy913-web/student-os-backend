const mongoose = require('mongoose');

const StudentRecordSchema = new mongoose.Schema(
  {
    studentId:       { type: String, required: true, unique: true, trim: true },
    rollNumber:      { type: String, required: true, unique: true, uppercase: true, trim: true },
    admissionNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    fullName:        { type: String, required: true, trim: true },
    gender:          { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    dob:             { type: Date, required: true },
    department:      { type: String, required: true, uppercase: true, trim: true },
    branch:          { type: String, required: true, uppercase: true, trim: true },
    course:          { type: String, required: true, uppercase: true, trim: true },
    academicYear:    { type: String, required: true, trim: true }, // e.g., '2023-2027'
    semester:        { type: Number, required: true, min: 1, max: 10 },
    section:         { type: String, required: true, uppercase: true, trim: true },
    batch:           { type: String, default: '', trim: true },
    collegeCode:     { type: String, required: true, uppercase: true, trim: true, index: true },
    parentDetails: {
      fatherName:  { type: String, default: '' },
      motherName:  { type: String, default: '' },
      parentPhone: { type: String, default: '' },
      parentEmail: { type: String, default: '' }
    },
    mobileNumber:    { type: String, default: '' },
    status:          { type: String, enum: ['Active', 'Suspended', 'Completed', 'Promoted', 'Transferred'], default: 'Active' },
    admissionDate:   { type: Date, default: Date.now },
    photo:           { type: String, default: '' },
    linkedUserId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null } // Links to the registered User in Student OS
  },
  { timestamps: true }
);

StudentRecordSchema.index({ rollNumber: 1, collegeCode: 1 }, { unique: true });

module.exports = mongoose.models.StudentRecord || mongoose.model('StudentRecord', StudentRecordSchema);
