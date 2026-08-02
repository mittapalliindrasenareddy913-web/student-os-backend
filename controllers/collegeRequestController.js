const CollegeRequest = require('../models/CollegeRequest');

const submitCollegeRequest = async (req, res) => {
  try {
    const {
      collegeName,
      aisheCode,
      university,
      state,
      district,
      city,
      collegeType,
      website,
      officialEmail,
      officialPhone,
      address,
      pincode,
      principalName,
      principalEmail
    } = req.body;

    if (!collegeName || !university || !state || !district || !city || !officialEmail || !officialPhone || !address || !pincode || !principalName || !principalEmail) {
      return res.status(400).json({ message: 'Missing mandatory registration fields.' });
    }

    const request = await CollegeRequest.create({
      collegeName,
      aisheCode,
      university,
      state,
      district,
      city,
      collegeType: collegeType || 'Private',
      website,
      officialEmail,
      officialPhone,
      address,
      pincode,
      principalName,
      principalEmail,
      status: 'pending'
    });

    res.status(201).json({ message: 'College registration request submitted to Super Admin.', request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCollegeRequests = async (req, res) => {
  try {
    const requests = await CollegeRequest.find().sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  submitCollegeRequest,
  getCollegeRequests
};
