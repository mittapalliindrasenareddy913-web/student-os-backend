const mongoose = require('mongoose');

const HostelAllocationSchema = new mongoose.Schema(
  {
    studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    block:       { type: String, required: true, uppercase: true },
    roomNumber:  { type: String, required: true },
    bedNumber:   { type: String, required: true },
    status:      { 
      type: String, 
      enum: ['Allocated', 'Vacated'], 
      default: 'Allocated' 
    },
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.HostelAllocation || mongoose.model('HostelAllocation', HostelAllocationSchema);
