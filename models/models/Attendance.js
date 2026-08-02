const mongoose = require('mongoose');

// ── Per-class record ────────────────────────────────────────────────────────
const ClassRecordSchema = new mongoose.Schema({
  date:    { type: Date, required: true },
  status:  { type: String, enum: ['present', 'absent', 'cancelled'], required: true },
  topic:   { type: String, default: '' },
  note:    { type: String, default: '' },
  weekday: { type: Number }, // 0=Sun…6=Sat stored for heatmap
}, { _id: true });

// ── Subject ─────────────────────────────────────────────────────────────────
const SubjectSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:         { type: String, required: true, trim: true },
  code:         { type: String, default: '', trim: true },
  faculty:      { type: String, default: '', trim: true },
  room:         { type: String, default: '', trim: true },

  // Schedule — days this subject runs (used for recovery planner)
  scheduledDays: [{ type: String, enum: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] }],
  classesPerWeek: { type: Number, default: 1 },

  // Running counters (denormalised for speed)
  totalClasses: { type: Number, default: 0 },
  attended:     { type: Number, default: 0 },
  cancelled:    { type: Number, default: 0 },

  // Policy
  requiredPct:  { type: Number, default: 75, min: 0, max: 100 },

  // Display
  color:        { type: String, default: '#8b5cf6' },
  isArchived:   { type: Boolean, default: false },

  // Full history for heatmap / calendar
  records: [ClassRecordSchema],
}, { timestamps: true });

// ── Virtuals ─────────────────────────────────────────────────────────────────
SubjectSchema.virtual('attendancePct').get(function () {
  if (!this.totalClasses) return 0;
  return Math.round((this.attended / this.totalClasses) * 100);
});

// How many MORE classes you can skip and still meet requiredPct
SubjectSchema.virtual('canBunk').get(function () {
  const req = this.requiredPct / 100;
  const surplus = this.attended - req * this.totalClasses;
  return Math.max(0, Math.floor(surplus / req));
});

// How many consecutive classes you must ATTEND to recover to requiredPct
SubjectSchema.virtual('needToAttend').get(function () {
  const pct = this.attendancePct;
  if (pct >= this.requiredPct) return 0;
  const req = this.requiredPct / 100;
  // After attending n more classes: (attended + n) / (total + n) >= req
  // n >= (req*total - attended) / (1 - req)
  const n = (req * this.totalClasses - this.attended) / (1 - req);
  return Math.ceil(Math.max(0, n));
});

// Estimated weeks to recover based on classesPerWeek
SubjectSchema.virtual('weeksToRecover').get(function () {
  const need = this.needToAttend;
  if (!need || !this.classesPerWeek) return 0;
  return Math.ceil(need / this.classesPerWeek);
});

// Status label: safe | warning | danger
SubjectSchema.virtual('statusLabel').get(function () {
  const pct = this.attendancePct;
  if (pct >= this.requiredPct) return 'safe';
  if (pct >= this.requiredPct - 5) return 'warning';
  return 'danger';
});

SubjectSchema.set('toJSON',   { virtuals: true });
SubjectSchema.set('toObject', { virtuals: true });

// Indexes for performance
SubjectSchema.index({ user: 1, name: 1 });
SubjectSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model('Subject', SubjectSchema);
