const mongoose = require('mongoose');

const FeeLedgerSchema = new mongoose.Schema(
  {
    studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalAmount: { type: Number, required: true },
    paidAmount:  { type: Number, default: 0 },
    dueAmount:   { type: Number, required: true },
    status:      { 
      type: String, 
      enum: ['Paid', 'Unpaid', 'Partial'], 
      default: 'Unpaid' 
    },
    type:        { 
      type: String, 
      enum: ['tuition', 'hostel', 'transport', 'exam'], 
      default: 'tuition' 
    },
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.FeeLedger || mongoose.model('FeeLedger', FeeLedgerSchema);
