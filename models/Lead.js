const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema(
  {
    collegeName:     { type: String, required: true, trim: true },
    contactPerson:   { type: String, required: true, trim: true },
    mobileNumber:    { type: String, required: true, trim: true },
    email:           { type: String, required: true, lowercase: true, trim: true },
    city:            { type: String, required: true, trim: true },
    studentStrength: { type: String, default: '' },
    message:         { type: String, default: '' },
    status:          { type: String, enum: ['pending', 'contacted', 'qualified', 'closed'], default: 'pending' }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
