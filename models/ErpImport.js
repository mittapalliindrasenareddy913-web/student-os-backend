const mongoose = require('mongoose');

const ErpImportSchema = new mongoose.Schema(
  {
    requestId:    { type: String, required: true, unique: true },
    principalId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    collegeCode:  { type: String, required: true, uppercase: true, index: true },
    version:      { type: Number, required: true },
    importType:   { 
      type: String, 
      enum: ['departments', 'hods', 'faculty', 'students', 'subjects', 'academics', 'timetable'], 
      required: true 
    },
    fileName:     { type: String, default: '' },
    status:       { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'failed', 'rolled_back'], 
      default: 'pending' 
    },
    totalRecords: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failedCount:  { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    duplicatesCount: { type: Number, default: 0 },
    warningsCount: { type: Number, default: 0 },
    duration:     { type: Number, default: 0 }, // in milliseconds
    errors:       [{
      row:      { type: Number },
      rowValue: { type: mongoose.Schema.Types.Mixed },
      reasons:  [{ type: String }]
    }],
    createdIds: {
      users:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
      subjects:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
      timetables:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Timetable' }]
    },
    ipAddress:    { type: String, default: '' },
    browser:      { type: String, default: '' },
    device:       { type: String, default: '' },
    rollbackReport: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

// Indexes for history display
ErpImportSchema.index({ collegeCode: 1, version: -1 });
ErpImportSchema.index({ collegeCode: 1, importType: 1 });

module.exports = mongoose.models.ErpImport || mongoose.model('ErpImport', ErpImportSchema);
