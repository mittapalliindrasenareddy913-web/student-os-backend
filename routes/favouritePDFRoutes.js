const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getFavourites, addFavourite, removeFavourite } = require('../controllers/favouritePDFController');

router.use(protect);
router.get('/',    getFavourites);
router.post('/',   addFavourite);
router.delete('/', removeFavourite);

module.exports = router;
