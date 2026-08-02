const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getTasks, createTask, updateTask, deleteTask, getTaskAnalytics } = require('../controllers/taskController');

router.use(protect);

router.get('/analytics', getTaskAnalytics);
router.get('/',     getTasks);
router.post('/',    createTask);
router.put('/:id',  updateTask);
router.delete('/:id', deleteTask);

module.exports = router;
