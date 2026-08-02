const mongoose = require('mongoose');

const PersonalTimetableSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    slots: [
      {
        day:       { type: String, required: true }, // e.g. "Mon"
        startTime: { type: String, required: true }, // e.g. "09:00"
        endTime:   { type: String, required: true }, // e.g. "10:00"
        subject:   { type: String, required: true },
        faculty:   { type: String, default: '' },
        room:      { type: String, default: '' },
        color:     { type: String, default: '#8b5cf6' }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.models.PersonalTimetable || mongoose.model('PersonalTimetable', PersonalTimetableSchema);
