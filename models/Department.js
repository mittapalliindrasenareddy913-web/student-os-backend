const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema(
  {
    code:        { type: String, required: true, uppercase: true, trim: true }, // e.g. CSE
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    logo:        { type: String, default: '' },
    hodId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status:      { type: String, enum: ['active', 'inactive'], default: 'active' },
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

// Enforce compound uniqueness for department code within the same college
DepartmentSchema.index({ code: 1, collegeCode: 1 }, { unique: true });

module.exports = mongoose.models.Department || mongoose.model('Department', DepartmentSchema);
