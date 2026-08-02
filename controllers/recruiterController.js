const JobDrive = require('../models/JobDrive');
const JobApplication = require('../models/JobApplication');
const Company = require('../models/Company');
const User = require('../models/User');
const { logAction } = require('../services/auditLogService');

const createJobDrive = async (req, res) => {
  try {
    const { title, role, jobType, packageAmount, minCgpa, allowedBranches } = req.body;
    if (!title || !role || !packageAmount) {
      return res.status(400).json({ message: 'Missing fields.' });
    }

    // Resolve recruiter company
    let company = await Company.findOne({ officialEmail: req.user.email });
    if (!company) {
      company = await Company.create({
        name: req.user.fullName || 'Recruiter Company',
        industry: 'Software',
        officialEmail: req.user.email,
        status: 'verified'
      });
    }

    const drive = await JobDrive.create({
      title,
      companyId: company._id,
      role,
      jobType,
      packageAmount,
      minCgpa: minCgpa || 6.0,
      allowedBranches: allowedBranches || []
    });

    res.status(201).json({ message: 'Placement drive published successfully.', drive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getJobDrives = async (req, res) => {
  try {
    const list = await JobDrive.find({}).populate('companyId', 'name');
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getEligibleStudents = async (req, res) => {
  try {
    const { minCgpa } = req.query;
    const cgpaLimit = parseFloat(minCgpa) || 6.0;

    // Retrieve students who have CGPA >= cgpaLimit
    const list = await User.find({
      role: 'student',
      isActive: true
    }).select('fullName email branch rollNumber year semester');

    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getApplications = async (req, res) => {
  try {
    const list = await JobApplication.find({})
      .populate('driveId', 'title role packageAmount')
      .populate('studentId', 'fullName rollNumber branch');
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body; // Shortlisted, Offered, Rejected

    const app = await JobApplication.findById(applicationId);
    if (!app) return res.status(404).json({ message: 'Application not found.' });

    app.status = status;
    await app.save();

    await logAction(app.studentId, 'student', '', '', `PLACEMENT_STATUS_UPDATED: ${status}`, req);

    res.status(200).json({ message: 'Candidate shortlist status updated successfully.', app });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createJobDrive,
  getJobDrives,
  getEligibleStudents,
  getApplications,
  updateApplicationStatus
};
