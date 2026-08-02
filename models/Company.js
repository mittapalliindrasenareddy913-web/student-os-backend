const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema(
  {
    name:          { type: String, required: true, trim: true },
    industry:      { type: String, required: true },
    officialEmail: { type: String, required: true, unique: true, lowercase: true },
    website:       { type: String, default: '' },
    status:        { 
      type: String, 
      enum: ['pending', 'verified', 'rejected'], 
      default: 'pending' 
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Company || mongoose.model('Company', CompanySchema);
