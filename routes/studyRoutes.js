const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl   = require('../controllers/studyController');

router.use(protect);

router.get('/',          ctrl.getAll);
router.get('/subjects',  ctrl.getSubjects);
router.get('/:id',       ctrl.getOne);
router.get('/:id/download', ctrl.downloadFile);
router.post('/',         ctrl.create);
router.put('/:id',       ctrl.update);
router.delete('/:id',    ctrl.remove);

module.exports = router;
