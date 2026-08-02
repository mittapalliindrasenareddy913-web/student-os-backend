const mongoose = require('mongoose');

// Single class slot
const SlotSchema = new mongoose.Schema({
  day:       { type: String, enum: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], required: true },
  startTime: { type: String, required: true }, // "09:00"
  endTime:   { type: String, required: true },
  subject:   { type: String, required: true },
  faculty:   { type: String, default: '' },
  room:      { type: String, default: '' },
  color:     { type: String, default: '#8b5cf6' },
}, { _id: false });

const TimetableSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  slots: [SlotSchema],
}, { timestamps: true });

module.exports = mongoose.model('Timetable', TimetableSchema);
