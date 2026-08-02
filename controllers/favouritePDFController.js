const FavouritePDF = require('../models/FavouritePDF');

// GET /api/favourites
const getFavourites = async (req, res) => {
  try {
    const list = await FavouritePDF.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(list.map(item => item.fileName));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// POST /api/favourites
const addFavourite = async (req, res) => {
  try {
    const { fileName } = req.body;
    if (!fileName) {
      return res.status(400).json({ message: 'fileName is required.' });
    }

    // Use findOneAndUpdate with upsert to avoid duplication issues
    const fav = await FavouritePDF.findOneAndUpdate(
      { user: req.user._id, fileName },
      { user: req.user._id, fileName },
      { upsert: true, new: true }
    );
    res.status(201).json(fav);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// DELETE /api/favourites?fileName=...
const removeFavourite = async (req, res) => {
  try {
    const { fileName } = req.query;
    if (!fileName) {
      return res.status(400).json({ message: 'fileName parameter required.' });
    }

    const result = await FavouritePDF.findOneAndDelete({ user: req.user._id, fileName });
    if (!result) {
      return res.status(404).json({ message: 'Favourite PDF record not found.' });
    }
    res.json({ message: 'Removed from favourites successfully.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { getFavourites, addFavourite, removeFavourite };
