const mongoose = require('mongoose');

const SeatingArrangementSchema = new mongoose.Schema(
  {
    examScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSchedule', required: true },
    room:           { type: String, required: true },
    arrangements: [
      {
        studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        rollNumber:  { type: String, required: true },
        benchNumber: { type: String, required: true },
        seatNumber:  { type: String, required: true }
      }
    ],
    collegeCode:    { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.SeatingArrangement || mongoose.model('SeatingArrangement', SeatingArrangementSchema);
