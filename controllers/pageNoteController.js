const PageNote = require('../models/PageNote');

// GET /api/pagenotes?fileName=...
const getPageNotes = async (req, res) => {
  try {
    const { fileName } = req.query;
    if (!fileName) {
      return res.status(400).json({ message: 'fileName parameter required.' });
    }
    const notes = await PageNote.find({ user: req.user._id, fileName }).sort({ createdAt: 1 });
    res.json(notes);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// POST /api/pagenotes
const createPageNote = async (req, res) => {
  try {
    const { fileName, pageNumber, x, y, content } = req.body;
    if (!fileName || !pageNumber || x === undefined || y === undefined) {
      return res.status(400).json({ message: 'fileName, pageNumber, x, and y are required.' });
    }

    const note = await PageNote.create({
      user: req.user._id,
      fileName,
      pageNumber,
      x,
      y,
      content: content || ''
    });
    res.status(201).json(note);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// PUT /api/pagenotes/:id
const updatePageNote = async (req, res) => {
  try {
    const { content } = req.body;
    const note = await PageNote.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { content: content || '' },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ message: 'PageNote not found.' });
    }
    res.json(note);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// DELETE /api/pagenotes/:id
const deletePageNote = async (req, res) => {
  try {
    const note = await PageNote.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!note) {
      return res.status(404).json({ message: 'PageNote not found.' });
    }
    res.json({ message: 'PageNote deleted successfully.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { getPageNotes, createPageNote, updatePageNote, deletePageNote };
