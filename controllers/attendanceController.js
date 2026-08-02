const Subject = require('../models/Attendance');
const User    = require('../models/User');

// ── Helper: recalculate dashboard attendance cache ───────────────────────
const syncDashboard = async (req, userId) => {
  const all = await Subject.find({ user: userId, isArchived: false });
  let overall = 0;
  if (all.length) {
    overall = Math.round(all.reduce((acc, x) => acc + x.attendancePct, 0) / all.length);
  }
  await User.findByIdAndUpdate(userId, { 'dashboardCache.attendancePercent': overall });

  const io = req.app.get('io');
  if (io) {
    io.to(userId.toString()).emit('attendance_updated');
  }
};

// ── GET /api/attendance ──────────────────────────────────────────────────
const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ user: req.user._id, isArchived: false }).sort('name');
    res.json(subjects);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── POST /api/attendance ─────────────────────────────────────────────────
const addSubject = async (req, res) => {
  try {
    const { name, code, faculty, room, requiredPct, color, scheduledDays, classesPerWeek } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Subject name is required.' });

    const s = await Subject.create({
      user: req.user._id,
      name, code, faculty, room,
      requiredPct: requiredPct ?? 75,
      color:  color || '#8b5cf6',
      scheduledDays: scheduledDays || [],
      classesPerWeek: classesPerWeek || 1,
    });
    res.status(201).json(s);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── PUT /api/attendance/:id ──────────────────────────────────────────────
const updateSubject = async (req, res) => {
  try {
    const allowed = ['name','code','faculty','room','requiredPct','color','scheduledDays','classesPerWeek','isArchived'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const s = await Subject.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true }
    );
    if (!s) return res.status(404).json({ message: 'Subject not found.' });
    res.json(s);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── DELETE /api/attendance/:id ───────────────────────────────────────────
const deleteSubject = async (req, res) => {
  try {
    await Subject.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    await syncDashboard(req, req.user._id);
    res.json({ message: 'Subject deleted.' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── POST /api/attendance/:id/record ─────────────────────────────────────
const markClass = async (req, res) => {
  try {
    const { date, status, topic, note } = req.body;
    if (!status) return res.status(400).json({ message: 'status is required.' });

    const s = await Subject.findOne({ _id: req.params.id, user: req.user._id });
    if (!s) return res.status(404).json({ message: 'Subject not found.' });

    const classDate = date ? new Date(date) : new Date();

    s.records.push({
      date: classDate,
      status,
      topic:   topic || '',
      note:    note  || '',
      weekday: classDate.getDay(),
    });

    if (status === 'present')    s.attended++;
    if (status !== 'cancelled')  s.totalClasses++;
    if (status === 'cancelled')  s.cancelled++;

    await s.save();
    await syncDashboard(req, req.user._id);
    res.json(s);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── DELETE /api/attendance/:id/record/:recordId ──────────────────────────
const deleteRecord = async (req, res) => {
  try {
    const s = await Subject.findOne({ _id: req.params.id, user: req.user._id });
    if (!s) return res.status(404).json({ message: 'Subject not found.' });

    const rec = s.records.id(req.params.recordId);
    if (!rec) return res.status(404).json({ message: 'Record not found.' });

    // Reverse the counters
    if (rec.status === 'present')    s.attended    = Math.max(0, s.attended - 1);
    if (rec.status !== 'cancelled')  s.totalClasses = Math.max(0, s.totalClasses - 1);
    if (rec.status === 'cancelled')  s.cancelled    = Math.max(0, s.cancelled - 1);

    s.records.pull(req.params.recordId);
    await s.save();
    await syncDashboard(req, req.user._id);
    res.json(s);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── GET /api/attendance/summary ──────────────────────────────────────────
const getSummary = async (req, res) => {
  try {
    const subjects = await Subject.find({ user: req.user._id, isArchived: false });

    const total    = subjects.length;
    const totalPct = total
      ? Math.round(subjects.reduce((a, s) => a + s.attendancePct, 0) / total)
      : 0;
    const safe    = subjects.filter(s => s.statusLabel === 'safe').length;
    const warning = subjects.filter(s => s.statusLabel === 'warning').length;
    const danger  = subjects.filter(s => s.statusLabel === 'danger').length;

    const totalPresent   = subjects.reduce((a, s) => a + s.attended, 0);
    const totalAbsent    = subjects.reduce((a, s) => a + (s.totalClasses - s.attended), 0);
    const totalCancelled = subjects.reduce((a, s) => a + (s.cancelled || 0), 0);

    res.json({
      total, totalPct, safe, warning, danger,
      totalPresent, totalAbsent, totalCancelled,
      subjects,
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── GET /api/attendance/:id/heatmap ─────────────────────────────────────
// Returns last 3 months of records mapped by date for calendar heatmap
const getHeatmap = async (req, res) => {
  try {
    const s = await Subject.findOne({ _id: req.params.id, user: req.user._id });
    if (!s) return res.status(404).json({ message: 'Subject not found.' });

    const since = new Date();
    since.setMonth(since.getMonth() - 3);

    const map = {};
    s.records
      .filter(r => r.date >= since)
      .forEach(r => {
        const key = r.date.toISOString().split('T')[0];
        map[key] = r.status; // 'present' | 'absent' | 'cancelled'
      });

    res.json({ subjectId: s._id, name: s.name, heatmap: map });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── GET /api/attendance/:id/analytics ───────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    const s = await Subject.findOne({ _id: req.params.id, user: req.user._id });
    if (!s) return res.status(404).json({ message: 'Subject not found.' });

    // Weekly trend — last 8 weeks
    const weeks = [];
    for (let w = 7; w >= 0; w--) {
      const start = new Date(); start.setDate(start.getDate() - w * 7 - 6);
      const end   = new Date(); end.setDate(end.getDate() - w * 7);
      start.setHours(0,0,0,0); end.setHours(23,59,59,999);

      const recs     = s.records.filter(r => r.date >= start && r.date <= end);
      const present  = recs.filter(r => r.status === 'present').length;
      const total    = recs.filter(r => r.status !== 'cancelled').length;
      weeks.push({
        label: `W${8-w}`,
        present, total,
        pct: total ? Math.round((present / total) * 100) : null,
      });
    }

    // Day-of-week pattern
    const dayPattern = Array(7).fill(0).map((_, d) => ({
      day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d],
      present: s.records.filter(r => r.weekday === d && r.status === 'present').length,
      absent:  s.records.filter(r => r.weekday === d && r.status === 'absent').length,
    }));

    res.json({
      subject: { _id: s._id, name: s.name, color: s.color },
      attendancePct: s.attendancePct,
      canBunk:       s.canBunk,
      needToAttend:  s.needToAttend,
      weeksToRecover: s.weeksToRecover,
      statusLabel:   s.statusLabel,
      weeklyTrend:   weeks,
      dayPattern,
      totalPresent:  s.attended,
      totalAbsent:   s.totalClasses - s.attended,
      totalCancelled: s.cancelled || 0,
      totalClasses:  s.totalClasses,
      records: s.records.slice(-30).reverse(), // last 30 records
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = {
  getSubjects, addSubject, updateSubject, deleteSubject,
  markClass, deleteRecord,
  getSummary, getHeatmap, getAnalytics,
};
