const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema(
  {
    collegeCode:   { type: String, required: true, unique: true, uppercase: true },
    planId:        { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: false },
    planName:      { type: String, default: 'Professional' },
    licenseKey:    { type: String, required: true, unique: true },
    expiryDate:    { type: Date, required: true },
    status:        { 
      type: String, 
      enum: ['Active', 'Expired', 'Suspended'], 
      default: 'Active' 
    },
    storageUsed:   { type: Number, default: 0 },
    aiCreditsUsed: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
