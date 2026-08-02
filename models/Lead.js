const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  author:    { type: String, required: true },
  text:      { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const LeadSchema = new mongoose.Schema(
  {
    institutionName: { type: String, required: true, trim: true },
    contactPerson:   { type: String, required: true, trim: true },
    email:           { type: String, required: true, lowercase: true, trim: true },
    phone:           { type: String, default: '', trim: true },
    city:            { type: String, default: '', trim: true },
    state:           { type: String, default: '', trim: true },
    estimatedStudents: { type: Number, default: 1000 },
    status: {
      type: String,
      enum: ['New', 'Contacted', 'In Progress', 'Converted', 'Lost'],
      default: 'New'
    },
    notes: [NoteSchema],
    convertedToCollegeCode: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
