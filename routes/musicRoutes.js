const express = require('express');
const router = express.Router();
const {
  searchSongs,
  getTrending,
  getLanguageSongs,
  getCategory,
  streamAudio
} = require('../controllers/musicController');

// ─── Music API Routes ─────────────────────────────────────────────────────

// Search songs by query (routes to JioSaavn backend)
// GET /api/music/search?q=Pushpa
router.get('/search', searchSongs);

// Get trending songs
// GET /api/music/trending
router.get('/trending', getTrending);

// Get songs by language
// GET /api/music/language/Telugu
router.get('/language/:language', getLanguageSongs);

// Get songs by category (mass, love, melody, party, etc)
// GET /api/music/category/mass
router.get('/category/:category', getCategory);

// Audio stream proxy (bypasses CORS on saavncdn.com)
// GET /api/music/stream?url=<encoded_audio_url>
router.get('/stream', streamAudio);

module.exports = router;
