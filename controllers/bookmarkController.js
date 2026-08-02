const Bookmark = require('../models/Bookmark');

// GET /api/bookmarks?fileName=...
const getBookmarks = async (req, res) => {
  try {
    const { fileName } = req.query;
    if (!fileName) {
      return res.status(400).json({ message: 'fileName parameter required.' });
    }
    const bookmarks = await Bookmark.find({ user: req.user._id, fileName }).sort({ pageNumber: 1 });
    res.json(bookmarks);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// POST /api/bookmarks
const createBookmark = async (req, res) => {
  try {
    const { fileName, pageNumber, title } = req.body;
    if (!fileName || !pageNumber || !title) {
      return res.status(400).json({ message: 'fileName, pageNumber, and title are required.' });
    }

    // Check if bookmark for this page already exists
    const existing = await Bookmark.findOne({ user: req.user._id, fileName, pageNumber });
    if (existing) {
      return res.status(400).json({ message: 'Bookmark for this page already exists.' });
    }

    const bookmark = await Bookmark.create({
      user: req.user._id,
      fileName,
      pageNumber,
      title
    });
    res.status(201).json(bookmark);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// PUT /api/bookmarks/:id
const updateBookmark = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'title is required.' });
    }

    const bookmark = await Bookmark.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { title },
      { new: true }
    );

    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark not found.' });
    }
    res.json(bookmark);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// DELETE /api/bookmarks/:id
const deleteBookmark = async (req, res) => {
  try {
    const bookmark = await Bookmark.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark not found.' });
    }
    res.json({ message: 'Bookmark deleted successfully.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { getBookmarks, createBookmark, updateBookmark, deleteBookmark };
