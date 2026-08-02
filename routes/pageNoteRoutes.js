const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getPageNotes, createPageNote, updatePageNote, deletePageNote } = require('../controllers/pageNoteController');

router.use(protect);
router.get('/',       getPageNotes);
router.post('/',      createPageNote);
router.put('/:id',    updatePageNote);
router.delete('/:id', deletePageNote);

module.exports = router;
