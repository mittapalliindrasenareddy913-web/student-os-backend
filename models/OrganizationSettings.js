const mongoose = require('mongoose');

const OrganizationSettingsSchema = new mongoose.Schema(
  {
    collegeCode: { type: String, required: true, unique: true, uppercase: true },
    timezone:    { type: String, default: 'Asia/Kolkata' },
    language:    { type: String, default: 'en' },
    dateFormat:  { type: String, default: 'DD/MM/YYYY' },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.models.OrganizationSettings || mongoose.model('OrganizationSettings', OrganizationSettingsSchema);
