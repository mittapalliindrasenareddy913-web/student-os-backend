const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    collegeCode:   { type: String, required: true, uppercase: true },
    planId:        { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    amount:        { type: Number, required: true },
    taxAmount:     { type: Number, default: 0 }, // 18% GST standard
    status:        { 
      type: String, 
      enum: ['Paid', 'Unpaid', 'Refunded'], 
      default: 'Paid' 
    },
    paymentGateway:{ type: String, default: 'Stripe' }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
