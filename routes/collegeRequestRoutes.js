const express = require('express');
const router = express.Router();
const { submitCollegeRequest, getCollegeRequests } = require('../controllers/collegeRequestController');

router.post('/', submitCollegeRequest);
router.get('/', getCollegeRequests);

module.exports = router;
