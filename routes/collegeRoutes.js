const express = require('express');
const router = express.Router();
const { searchColleges, directorySearch, requestActivation, getCollegeNameByCode } = require('../controllers/collegeController');

router.get('/search', searchColleges);
router.get('/directory', directorySearch);
router.get('/details/:code', getCollegeNameByCode);
router.post('/request-activation', requestActivation);

module.exports = router;
