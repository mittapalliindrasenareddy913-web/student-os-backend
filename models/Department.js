const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema(
  {
    collegeCode:  { type: String, required: true, uppercase: true, trim: true, index: true },
    deptCode:     { type: String, required: true, uppercase: true, trim: true },
    code:         { type: String, required: true, uppercase: true, trim: true },
    name:         { type: String, required: true, trim: true },
    description:  { type: String, default: '' },
    hodId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hodName:      { type: String, default: '' },
    studentCount: { type: Number, default: 0 },
    facultyCount: { type: Number, default: 0 },
    isActive:     { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Department || mongoose.model('Department', DepartmentSchema);
