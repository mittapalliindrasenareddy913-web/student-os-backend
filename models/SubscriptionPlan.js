const mongoose = require('mongoose');

const SubscriptionPlanSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    monthlyPrice: { type: Number, required: true },
    yearlyPrice:  { type: Number, required: true },
    maxStudents:  { type: Number, default: 500 },
    maxFaculty:   { type: Number, default: 50 },
    maxStorage:   { type: Number, default: 10 }, // in GB
    maxAiCredits: { type: Number, default: 1000 },
    isActive:     { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.SubscriptionPlan || mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
