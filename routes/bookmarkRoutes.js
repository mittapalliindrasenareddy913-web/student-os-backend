const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getBookmarks, createBookmark, updateBookmark, deleteBookmark } = require('../controllers/bookmarkController');

router.use(protect);
router.get('/',       getBookmarks);
router.post('/',      createBookmark);
router.put('/:id',    updateBookmark);
router.delete('/:id', deleteBookmark);

module.exports = router;
