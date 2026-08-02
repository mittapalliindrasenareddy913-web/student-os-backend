const College = require('../models/College');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { logAction } = require('../services/auditLogService');

// Add a college placeholder in the Master Database
const addMasterCollege = async (req, res) => {
  try {
    const { collegeCode, name, address, university, state, district, departments } = req.body;

    if (!collegeCode || !name) {
      return res.status(400).json({ message: 'College Code and Name are required.' });
    }

    const exists = await College.findOne({ collegeCode: collegeCode.toUpperCase() });
    if (exists) {
      return res.status(400).json({ message: 'College with this code already exists.' });
    }

    const college = await College.create({
      collegeCode: collegeCode.toUpperCase(),
      name,
      address,
      university,
      state,
      district,
      departments: departments || ['ECE', 'CSE', 'EEE', 'Civil'],
      status: 'pending_activation'
    });

    await logAction(req.user._id, 'super_admin', '', '', `CREATED_MASTER_COLLEGE: ${collegeCode}`, req);

    res.status(201).json({ message: 'Master College entry created successfully.', college });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// List all colleges
const getAllColleges = async (req, res) => {
  try {
    const colleges = await College.find({});
    res.status(200).json(colleges);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Approve college activation
const approveCollegeActivation = async (req, res) => {
  try {
    const { code } = req.params;
    const college = await College.findOne({ collegeCode: code.toUpperCase() });

    if (!college) {
      return res.status(404).json({ message: 'College not found.' });
    }

    if (college.status === 'active') {
      return res.status(400).json({ message: 'College is already activated.' });
    }

    college.status = 'active';
    college.activatedAt = new Date();
    await college.save();

    await logAction(req.user._id, 'super_admin', code, '', `APPROVED_COLLEGE_ACTIVATION: ${code}`, req);

    res.status(200).json({ message: `College ${code} activated successfully.`, college });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Suspend or reactivate college
const toggleCollegeStatus = async (req, res) => {
  try {
    const { code } = req.params;
    const { status } = req.body; // 'active' or 'suspended'

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value. Must be active or suspended.' });
    }

    const college = await College.findOne({ collegeCode: code.toUpperCase() });
    if (!college) {
      return res.status(404).json({ message: 'College not found.' });
    }

    college.status = status;
    await college.save();

    // Disable all users of this college if suspended
    if (status === 'suspended') {
      await User.updateMany({ collegeCode: code.toUpperCase() }, { isActive: false });
    } else {
      // Re-enable principal and active staff
      await User.updateMany({ collegeCode: code.toUpperCase(), role: { $in: ['principal', 'hod', 'faculty'] } }, { isActive: true });
    }

    await logAction(req.user._id, 'super_admin', code, '', `TOGGLED_COLLEGE_STATUS: ${code} to ${status}`, req);

    res.status(200).json({ message: `College status updated to ${status}.`, college });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// View analytics
const getPlatformAnalytics = async (req, res) => {
  try {
    const totalColleges = await College.countDocuments({});
    const activeColleges = await College.countDocuments({ status: 'active' });
    const pendingColleges = await College.countDocuments({ status: 'pending_activation' });
    
    const studentCount = await User.countDocuments({ role: 'student' });
    const staffCount = await User.countDocuments({ role: { $in: ['principal', 'hod', 'faculty'] } });

    res.status(200).json({
      totalColleges,
      activeColleges,
      pendingColleges,
      studentCount,
      staffCount
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  addMasterCollege,
  getAllColleges,
  approveCollegeActivation,
  toggleCollegeStatus,
  getPlatformAnalytics
};
