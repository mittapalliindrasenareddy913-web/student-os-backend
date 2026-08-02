const mongoose = require('mongoose');

const HallTicketSchema = new mongoose.Schema(
  {
    studentId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rollNumber:          { type: String, required: true, uppercase: true, trim: true },
    qrCodeData:          { type: String, default: '' },
    status:              { 
      type: String, 
      enum: ['draft', 'preview', 'approved', 'published'], 
      default: 'draft' 
    },
    eligibilityVerified: { type: Boolean, default: false },
    attendancePct:       { type: Number, default: 100 },
    internalMarksStatus: { type: String, enum: ['Eligible', 'Ineligible'], default: 'Eligible' },
    feeStatus:           { type: String, default: 'Paid' },
    detainedStatus:      { type: Boolean, default: false },
    subjects:            [{ type: String }],
    examDates:           [{ type: Date }],
    instructions:        { type: String, default: '1. Candidates must carry this ticket and College ID.\n2. Malpractice leads to immediate suspension.' },
    collegeCode:         { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.HallTicket || mongoose.model('HallTicket', HallTicketSchema);
