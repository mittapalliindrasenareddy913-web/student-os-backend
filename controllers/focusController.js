const FocusSession = require('../models/FocusSession');
const User = require('../models/User');

// GET /api/focus
const getSessions = async (req, res) => {
  try {
    const sessions = await FocusSession.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
    // Today total
    const start = new Date(); start.setHours(0,0,0,0);
    const end   = new Date(); end.setHours(23,59,59,999);
    const todaySessions = sessions.filter(s => s.createdAt >= start && s.createdAt <= end);
    const todayMin = todaySessions.reduce((a, s) => a + (s.actualMin || 0), 0);
    res.json({ sessions, todayMin });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// POST /api/focus — create session when user starts
const startSession = async (req, res) => {
  try {
    const { durationMin, mode, subject, ambientSound } = req.body;
    const session = await FocusSession.create({
      user: req.user._id, durationMin, mode, subject, ambientSound,
    });
    res.status(201).json(session);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// PUT /api/focus/:id/complete — log completion
const completeSession = async (req, res) => {
  try {
    const { actualMin } = req.body;
    const session = await FocusSession.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { actualMin, isCompleted: true, completedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'Session not found.' });

    // Update user totals
    const user = await User.findById(req.user._id);
    const newTotal = (user.totalFocusMinutes || 0) + actualMin;
    await User.findByIdAndUpdate(req.user._id, {
      totalFocusMinutes: newTotal,
      'dashboardCache.focusMinutesToday': newTotal, // simplified
    });
    res.json(session);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = { getSessions, startSession, completeSession };
