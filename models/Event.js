const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type:        { 
      type: String, 
      enum: ['seminar', 'workshop', 'hackathon', 'sports', 'guest_lecture', 'cultural'], 
      default: 'seminar' 
    },
    startDate:   { type: Date, required: true },
    endDate:     { type: Date, required: true },
    registrations: [
      {
        studentId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        registrationDate: { type: Date, default: Date.now }
      }
    ],
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Event || mongoose.model('Event', EventSchema);
