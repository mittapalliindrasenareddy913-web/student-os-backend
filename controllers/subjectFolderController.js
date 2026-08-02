const SubjectFolder = require('../models/SubjectFolder');
const StudyMaterial = require('../models/StudyMaterial');
const Timetable = require('../models/Timetable');

// Sync helper: ensure all subjects in user's timetable slots have a folder
const syncFoldersWithTimetable = async (userId) => {
  try {
    const timetable = await Timetable.findOne({ user: userId });
    if (!timetable || !timetable.slots) return;

    const subjects = [...new Set(timetable.slots.map(s => s.subject?.trim()).filter(Boolean))];
    for (const name of subjects) {
      const exists = await SubjectFolder.findOne({ user: userId, name });
      if (!exists) {
        await SubjectFolder.create({ user: userId, name });
      }
    }
  } catch (err) {
    console.error('Error syncing folders with timetable:', err.message);
  }
};

// GET /api/folders
const getFolders = async (req, res) => {
  try {
    // Auto-sync folders with timetable first
    await syncFoldersWithTimetable(req.user._id);

    const folders = await SubjectFolder.find({ user: req.user._id }).sort({ name: 1 });
    const list = [];
    
    for (const folder of folders) {
      const pdfCount = await StudyMaterial.countDocuments({
        userId: req.user._id,
        subject: folder.name,
        type: 'pdf'
      });
      list.push({
        _id: folder._id,
        name: folder.name,
        pdfCount
      });
    }

    res.json(list);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// POST /api/folders
const createFolder = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Folder name is required.' });
    }

    const folderName = name.trim();
    const exists = await SubjectFolder.findOne({ user: req.user._id, name: folderName });
    if (exists) {
      return res.status(400).json({ message: 'Folder already exists.' });
    }

    const folder = await SubjectFolder.create({
      user: req.user._id,
      name: folderName
    });

    res.status(201).json({
      _id: folder._id,
      name: folder.name,
      pdfCount: 0
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// PUT /api/folders/:id (Rename folder)
const renameFolder = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'New folder name is required.' });
    }

    const newName = name.trim();
    const folder = await SubjectFolder.findOne({ _id: req.params.id, user: req.user._id });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found.' });
    }

    const oldName = folder.name;
    if (oldName === newName) {
      return res.json({ message: 'Folder name unchanged.', folder });
    }

    // Check if new name exists
    const duplicate = await SubjectFolder.findOne({ user: req.user._id, name: newName });
    if (duplicate) {
      return res.status(400).json({ message: 'A folder with this name already exists.' });
    }

    // Update folder name
    folder.name = newName;
    await folder.save();

    // Cascade update: update all materials' subject names
    await StudyMaterial.updateMany(
      { userId: req.user._id, subject: oldName },
      { $set: { subject: newName } }
    );

    // Cascade update: update all timetable slots' subject names
    const tt = await Timetable.findOne({ user: req.user._id });
    if (tt && tt.slots) {
      tt.slots.forEach(slot => {
        if (slot.subject === oldName) {
          slot.subject = newName;
        }
      });
      await tt.save();
    }

    res.json({
      _id: folder._id,
      name: folder.name,
      pdfCount: await StudyMaterial.countDocuments({ userId: req.user._id, subject: newName, type: 'pdf' })
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// DELETE /api/folders/:id
const deleteFolder = async (req, res) => {
  try {
    const folder = await SubjectFolder.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found.' });
    }

    // Cascade delete: delete all study materials in this subject
    await StudyMaterial.deleteMany({ userId: req.user._id, subject: folder.name });

    // Cascade update: clear slot subject fields matching deleted subject in timetable
    const tt = await Timetable.findOne({ user: req.user._id });
    if (tt && tt.slots) {
      tt.slots = tt.slots.filter(slot => slot.subject !== folder.name);
      await tt.save();
    }

    res.json({ message: 'Folder deleted successfully.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// POST /api/folders/move
const movePDF = async (req, res) => {
  try {
    const { materialId, targetSubject } = req.body;
    if (!materialId || !targetSubject) {
      return res.status(400).json({ message: 'materialId and targetSubject are required.' });
    }

    const material = await StudyMaterial.findOne({ _id: materialId, userId: req.user._id });
    if (!material) {
      return res.status(404).json({ message: 'Study material not found.' });
    }

    // Update subject name to targetSubject
    material.subject = targetSubject.trim();
    await material.save();

    res.json({ success: true, material });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { getFolders, createFolder, renameFolder, deleteFolder, movePDF };
