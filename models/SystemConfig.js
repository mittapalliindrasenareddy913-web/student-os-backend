const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema(
  {
    key:                   { type: String, default: 'global_config', unique: true },
    academicYears:         [{ type: String }],
    semesterRules:         { type: String, default: 'June to Dec (Odd), Jan to May (Even)' },
    gradingRules:          { type: mongoose.Schema.Types.Mixed, default: { 'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'F': 0 } },
    attendanceRules:       { type: mongoose.Schema.Types.Mixed, default: { minPercentage: 75 } },
    notificationTemplates: { type: mongoose.Schema.Types.Mixed, default: {} },
    emailTemplates:        { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.models.SystemConfig || mongoose.model('SystemConfig', SystemConfigSchema);
