const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { getTimetable, addSlot, updateSlot, deleteSlot, uploadTimetable } = require('../controllers/timetableController');

// Multer memory storage configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.use(protect);

router.get('/', getTimetable);
router.post('/upload', upload.single('file'), uploadTimetable);
router.post('/slot', addSlot);
router.put('/slot/:idx', updateSlot);
router.delete('/slot/:idx', deleteSlot);

module.exports = router;

