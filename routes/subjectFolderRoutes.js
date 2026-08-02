const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getFolders, createFolder, renameFolder, deleteFolder, movePDF } = require('../controllers/subjectFolderController');

router.use(protect);
router.get('/',       getFolders);
router.post('/',      createFolder);
router.put('/:id',    renameFolder);
router.delete('/:id', deleteFolder);
router.post('/move',  movePDF);

module.exports = router;
