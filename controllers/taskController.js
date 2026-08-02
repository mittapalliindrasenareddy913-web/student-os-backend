const Task = require('../models/Task');
const User = require('../models/User');

const syncCache = async (userId) => {
  const pending   = await Task.countDocuments({ user: userId, status: { $ne: 'completed' } });
  const completed = await Task.countDocuments({ user: userId, status: 'completed' });
  await User.findByIdAndUpdate(userId, {
    'dashboardCache.tasksPending':   pending,
    'dashboardCache.tasksCompleted': completed,
  });
};

// GET /api/tasks
const getTasks = async (req, res) => {
  try {
    const { status, priority, category } = req.query;
    const filter = { user: req.user._id };
    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    
    const tasks = await Task.find(filter).sort({ isPinned: -1, dueDate: 1, createdAt: -1 });
    res.json(tasks);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// POST /api/tasks
const createTask = async (req, res) => {
  try {
    const { title, description, category, subject, priority, dueDate, tags, subtasks, hasReminder, reminderTime, recurrence, color } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required.' });
    
    const task = await Task.create({ 
      user: req.user._id, title, description, category, subject, priority, dueDate, tags, 
      subtasks, hasReminder, reminderTime, recurrence, color 
    });
    
    await syncCache(req.user._id);
    res.status(201).json(task);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// PUT /api/tasks/:id
const updateTask = async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.body.status === 'completed') {
      update.completedAt = new Date();
    } else if (req.body.status !== undefined && req.body.status !== 'completed') {
      update.$unset = { completedAt: 1 };
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      update,
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    await syncCache(req.user._id);
    res.json(task);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// DELETE /api/tasks/:id
const deleteTask = async (req, res) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    await syncCache(req.user._id);
    res.json({ message: 'Deleted.' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// GET /api/tasks/analytics
const getTaskAnalytics = async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user._id });
    
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = total - completed;
    
    const now = new Date();
    const overdue = tasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now).length;
    
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const priorityStats = {
      High: tasks.filter(t => t.priority === 'High' && t.status !== 'completed').length,
      Medium: tasks.filter(t => t.priority === 'Medium' && t.status !== 'completed').length,
      Low: tasks.filter(t => t.priority === 'Low' && t.status !== 'completed').length,
    };

    // Last 7 days completion trend
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      
      const startOfDay = new Date(d); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(d); endOfDay.setHours(23,59,59,999);
      
      const count = tasks.filter(t => 
        t.status === 'completed' && 
        t.completedAt && 
        new Date(t.completedAt) >= startOfDay && 
        new Date(t.completedAt) <= endOfDay
      ).length;
      
      weeklyTrend.push({ label: dateStr, count });
    }

    res.json({
      total, completed, pending, overdue, completionRate, priorityStats, weeklyTrend
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = { getTasks, createTask, updateTask, deleteTask, getTaskAnalytics };
