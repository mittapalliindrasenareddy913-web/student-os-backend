const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    type:        { 
      type: String, 
      enum: ['Notes', 'Lab Manual', 'Question Bank', 'Previous Paper', 'Reference Book', 'Additional Resource'], 
      default: 'Notes' 
    },
    fileUrl:     { type: String, default: '' },
    fileType:    { type: String, default: '' }, // pdf, pptx, docx, image, etc.
    subjectCode: { type: String, uppercase: true, trim: true },
    section:     { type: String, uppercase: true, trim: true },
    unit:        { type: String, trim: true },
    description: { type: String, default: '' },
    facultyId:   { type: String, trim: true },
    department:  { type: String, uppercase: true, trim: true },
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Material || mongoose.model('Material', MaterialSchema);
