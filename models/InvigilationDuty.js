const mongoose = require('mongoose');

const InvigilationDutySchema = new mongoose.Schema(
  {
    facultyId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    examScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSchedule', required: true },
    room:           { type: String, required: true },
    date:           { type: Date, required: true },
    time:           { type: String, required: true },
    status:         { type: String, enum: ['assigned', 'completed', 'cancelled'], default: 'assigned' },
    collegeCode:    { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.InvigilationDuty || mongoose.model('InvigilationDuty', InvigilationDutySchema);
