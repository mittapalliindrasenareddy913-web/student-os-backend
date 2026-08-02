const Note = require('../models/Note');

// GET /api/notes
const getNotes = async (req, res) => {
  try {
    const { subject, folder, search } = req.query;
    const filter = { user: req.user._id };
    
    if (subject && subject !== 'All') filter.subject = subject;
    if (folder && folder !== 'All') filter.folder = folder;
    if (search) filter.$text = { $search: search };
    
    const notes = await Note.find(filter).sort({ isPinned: -1, isFav: -1, updatedAt: -1 });
    res.json(notes);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// POST /api/notes
const createNote = async (req, res) => {
  try {
    const { title, content, subject, folder, tags, color, isPinned, isFav, attachments } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required.' });
    
    const note = await Note.create({ 
      user: req.user._id, title, content, subject, folder, tags, color, isPinned, isFav, attachments 
    });
    res.status(201).json(note);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// PUT /api/notes/:id
const updateNote = async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );
    if (!note) return res.status(404).json({ message: 'Note not found.' });
    res.json(note);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// DELETE /api/notes/:id
const deleteNote = async (req, res) => {
  try {
    await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Deleted.' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = { getNotes, createNote, updateNote, deleteNote };
