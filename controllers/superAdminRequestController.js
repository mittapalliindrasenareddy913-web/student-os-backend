const bcrypt = require('bcryptjs');
const CollegeRequest = require('../models/CollegeRequest');
const College = require('../models/College');
const User = require('../models/User');
const Department = require('../models/Department');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const SupportTicket = require('../models/SupportTicket');
const Lead = require('../models/Lead');
const SystemConfig = require('../models/SystemConfig');
const BackupHistory = require('../models/BackupHistory');
const AuditLog = require('../models/AuditLog');
const { logAction } = require('../services/auditLogService');

const notifySocket = (req, event, data) => {
  try {
    const io = req.app.get('socketio');
    if (io) io.emit(event, data);
  } catch (err) {
    console.error('Socket notification error:', err.message);
  }
};

let maintenanceModeActive = false;

let integrationsConfig = {
  firebaseKey: 'masked_firebase_credential_key',
  mongoUri: 'mongodb://localhost:27017/campus_os',
  emailProviderKey: 'masked_resend_api_key',
  smsProviderKey: 'masked_twilio_sms_key',
  paymentGatewayKey: 'masked_stripe_secret_key',
  cloudStorageBucket: 'r2_bucket_production'
};

// =============================================================
// 1. EXECUTIVE OVERVIEW & DASHBOARD STATS (LIVE AGGREGATIONS)
// =============================================================
const getSaaSStats = async (req, res) => {
  try {
    const totalColleges = await College.countDocuments({ isDeleted: false });
    const verifiedColleges = await College.countDocuments({ status: 'active', isDeleted: false });
    const pendingColleges = await CollegeRequest.countDocuments({ status: 'pending' });

    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalFaculty = await User.countDocuments({ role: 'faculty' });
    const totalHods = await User.countDocuments({ role: 'hod' });
    const totalCoes = await User.countDocuments({ role: 'coe' });
    const totalPrincipals = await User.countDocuments({ role: 'principal' });
    const totalUsers = await User.countDocuments({});

    const totalDepartments = await Department.countDocuments({ isActive: true });

    // Billing calculations
    const invoices = await Invoice.find({ status: 'Paid' });
    const monthlyRevenue = invoices.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    const memory = process.memoryUsage();

    res.status(200).json({
      totalColleges,
      activeColleges: verifiedColleges,
      pendingColleges,
      totalStudents,
      totalFaculty,
      totalHods,
      totalCoes,
      totalPrincipals,
      totalDepartments,
      totalActiveUsers: totalUsers,
      storageUsage: `${(totalColleges * 0.8).toFixed(1)} GB / 100 GB`,
      monthlyRevenue: `$${monthlyRevenue.toLocaleString()}`,
      systemHealth: 'healthy',
      serverStatus: 'healthy',
      databaseStatus: 'connected',
      cpuUsage: '4%',
      memoryUsage: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
      socketConnections: 1,
      activeRooms: 1,
      maintenanceMode: maintenanceModeActive
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 2. PRIORITY 1: COMPLETE COLLEGE REGISTRATION ENGINE
// =============================================================
const registerFullCollege = async (req, res) => {
  try {
    const {
      name,
      collegeCode,
      collegeType,
      university,
      country,
      state,
      district,
      city,
      address,
      pincode,
      officialEmail,
      officialPhone,
      website,
      principalName,
      principalEmail,
      principalPhone,
      subscriptionPlan,
      maxStudents,
      maxFaculty,
      maxDepartments,
      logo,
      status
    } = req.body;

    // Field Validation
    if (!collegeCode || !name) {
      return res.status(400).json({ message: 'College Code and College Name are required fields.' });
    }

    const cleanCode = collegeCode.toUpperCase().trim();

    // Check duplicate collegeCode
    const codeExists = await College.findOne({ collegeCode: cleanCode });
    if (codeExists) {
      return res.status(400).json({ message: `College Code '${cleanCode}' is already registered.` });
    }

    // Check duplicate officialEmail or principalEmail if provided
    if (officialEmail) {
      const emailExists = await College.findOne({ officialEmail: officialEmail.toLowerCase().trim() });
      if (emailExists) {
        return res.status(400).json({ message: `Official Email '${officialEmail}' is already registered with another college.` });
      }
    }

    if (principalEmail) {
      const userEmailExists = await User.findOne({ email: principalEmail.toLowerCase().trim() });
      if (userEmailExists) {
        return res.status(400).json({ message: `Principal Email '${principalEmail}' is already registered to an existing account.` });
      }
    }

    // Generate unique Institution ID
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const institutionId = `INST-${cleanCode}-${randomSuffix}`;

    // 1. Create College Document
    const college = await College.create({
      institutionId,
      collegeCode: cleanCode,
      name: name.trim(),
      collegeType: collegeType || 'Private',
      university: university || 'Affiliated State University',
      country: country || 'India',
      state: state || '',
      district: district || '',
      city: city || '',
      address: address || '',
      pincode: pincode || '',
      officialEmail: officialEmail ? officialEmail.toLowerCase().trim() : `${cleanCode.toLowerCase()}@college.edu`,
      officialPhone: officialPhone || '',
      website: website || '',
      logo: logo || '',
      principalName: principalName || 'Principal Administrator',
      principalEmail: principalEmail ? principalEmail.toLowerCase().trim() : `principal@${cleanCode.toLowerCase()}.edu`,
      principalPhone: principalPhone || '',
      subscriptionPlan: subscriptionPlan || 'Professional',
      maxStudents: Number(maxStudents) || 2000,
      maxFaculty: Number(maxFaculty) || 200,
      maxDepartments: Number(maxDepartments) || 12,
      status: status === 'pending' ? 'pending_verification' : 'active',
      departments: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT'],
      courses: ['B.Tech', 'M.Tech', 'MBA', 'MCA'],
      branches: ['Computer Science', 'Electronics', 'Mechanical'],
      activatedAt: new Date()
    });

    // 2. Create Default Departments for this College Tenant
    const defaultDepts = [
      { deptCode: 'CSE', name: 'Computer Science & Engineering' },
      { deptCode: 'ECE', name: 'Electronics & Communication' },
      { deptCode: 'EEE', name: 'Electrical & Electronics' },
      { deptCode: 'MECH', name: 'Mechanical Engineering' },
      { deptCode: 'CIVIL', name: 'Civil Engineering' },
      { deptCode: 'IT', name: 'Information Technology' }
    ];

    for (const d of defaultDepts) {
      await Department.create({
        collegeCode: cleanCode,
        deptCode: d.deptCode,
        code: d.deptCode,
        name: d.name,
        isActive: true
      });
    }

    // 3. Provision Master Principal User Account
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('College@123', salt);
    const pEmail = principalEmail ? principalEmail.toLowerCase().trim() : `principal@${cleanCode.toLowerCase()}.edu`;

    const principalUser = await User.create({
      fullName: principalName || `${cleanCode} Principal`,
      email: pEmail,
      username: pEmail.split('@')[0],
      password: defaultPassword,
      role: 'principal',
      collegeCode: cleanCode,
      department: 'Administration',
      status: 'ACTIVE',
      isActive: true
    });

    // 4. Create Subscription & Billing Invoice
    const licKey = `LIC-${cleanCode}-${Date.now().toString().slice(-6)}`;
    await Subscription.create({
      collegeCode: cleanCode,
      planId: null,
      licenseKey: licKey,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: 'Active'
    });

    const invNum = `INV-${cleanCode}-${Date.now().toString().slice(-6)}`;
    await Invoice.create({
      invoiceNumber: invNum,
      collegeCode: cleanCode,
      amount: 1999,
      taxAmount: 359,
      status: 'Paid',
      paymentGateway: 'Stripe'
    });

    // 5. Audit Log & Notifications
    await logAction(req.user._id, 'super_admin', cleanCode, '', `REGISTERED_MASTER_COLLEGE: ${cleanCode} (${name})`, req, null, college.toObject());
    notifySocket(req, 'COLLEGE_REGISTERED', { collegeCode: cleanCode, name });

    res.status(201).json({
      message: `Institution '${name}' (${cleanCode}) registered successfully with Principal account.`,
      college,
      principalUser: { email: principalUser.email, initialPassword: 'College@123' },
      institutionId
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add Quick College
const addMasterCollege = async (req, res) => {
  return registerFullCollege(req, res);
};

// =============================================================
// 3. INSTITUTIONS REGISTRY CRUD & DETAILS DRAWER
// =============================================================
const getAllColleges = async (req, res) => {
  try {
    const { search, state, status, type } = req.query;
    let query = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { collegeCode: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }
    if (state && state !== 'all') query.state = state;
    if (status && status !== 'all') query.status = status;
    if (type && type !== 'all') query.collegeType = type;

    const list = await College.find(query).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCollegeDetails = async (req, res) => {
  try {
    const { code } = req.params;
    const college = await College.findOne({ collegeCode: code.toUpperCase() });
    if (!college) return res.status(404).json({ message: 'College not found.' });

    const departments = await Department.find({ collegeCode: code.toUpperCase() });
    const studentsCount = await User.countDocuments({ collegeCode: code.toUpperCase(), role: 'student' });
    const facultyCount = await User.countDocuments({ collegeCode: code.toUpperCase(), role: 'faculty' });
    const auditLogs = await AuditLog.find({ collegeCode: code.toUpperCase() }).sort({ createdAt: -1 }).limit(10);

    res.status(200).json({
      college,
      departments,
      studentsCount,
      facultyCount,
      auditLogs
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateCollege = async (req, res) => {
  try {
    const { id } = req.params;
    const oldCol = await College.findById(id);
    if (!oldCol) return res.status(404).json({ message: 'College not found.' });

    const newCol = await College.findByIdAndUpdate(id, req.body, { new: true });
    await logAction(req.user._id, 'super_admin', oldCol.collegeCode, '', 'UPDATED_COLLEGE_DETAILS', req, oldCol.toObject(), newCol.toObject());
    res.status(200).json({ message: 'College details updated successfully.', college: newCol });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteCollege = async (req, res) => {
  try {
    const { id } = req.params;
    const col = await College.findById(id);
    if (!col) return res.status(404).json({ message: 'College not found.' });

    col.isDeleted = true;
    await col.save();

    await logAction(req.user._id, 'super_admin', col.collegeCode, '', `SOFT_DELETED_COLLEGE: ${col.collegeCode}`, req);
    res.status(200).json({ message: `College '${col.name}' removed.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleCollegeStatus = async (req, res) => {
  try {
    const { code } = req.params;
    const { status } = req.body;
    const targetStatus = status || 'suspended';

    const college = await College.findOne({ collegeCode: code.toUpperCase() });
    if (!college) return res.status(404).json({ message: 'College not found.' });

    college.status = targetStatus;
    await college.save();

    await User.updateMany({ collegeCode: code.toUpperCase() }, { isActive: targetStatus === 'active' });
    await logAction(req.user._id, 'super_admin', code, '', `TOGGLED_COLLEGE_STATUS: ${code} to ${targetStatus}`, req);

    res.status(200).json({ message: `College '${code}' status changed to ${targetStatus}.`, college });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 4. CROSS-COLLEGE USERS MANAGEMENT
// =============================================================
const getAllPlatformUsers = async (req, res) => {
  try {
    const list = await User.find({}).select('-password -refreshTokens').sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const targetPass = newPassword || 'Pass@123';

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(targetPass, salt);
    await user.save();

    await logAction(req.user._id, 'super_admin', user.collegeCode || 'GLOBAL', '', `RESET_USER_PASSWORD: ${user.email}`, req);
    res.status(200).json({ message: `Password for ${user.email} reset to ${targetPass}.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleUserAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.isActive = !user.isActive;
    await user.save();

    await logAction(req.user._id, 'super_admin', user.collegeCode || 'GLOBAL', '', `TOGGLED_USER_STATUS: ${user.email}`, req);
    res.status(200).json({ message: `User status changed to ${user.isActive ? 'Active' : 'Suspended'}.`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteUserAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    await logAction(req.user._id, 'super_admin', user.collegeCode || 'GLOBAL', '', `DELETED_USER: ${user.email}`, req);
    res.status(200).json({ message: 'User account deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 5. APPROVALS QUEUE & ONBOARDING REQUESTS
// =============================================================
const approveRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await CollegeRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Onboarding request not found.' });

    request.status = 'approved';
    await request.save();

    // Auto-create college from approved request
    req.body = {
      name: request.collegeName,
      collegeCode: request.aisheCode || `COL-${Math.floor(100 + Math.random() * 900)}`,
      university: request.university,
      state: request.state,
      district: request.district,
      city: request.city,
      address: request.address,
      pincode: request.pincode,
      officialEmail: request.officialEmail,
      officialPhone: request.officialPhone,
      principalName: request.principalName,
      principalEmail: request.principalEmail,
      status: 'active'
    };

    return registerFullCollege(req, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await CollegeRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Onboarding request not found.' });

    request.status = 'rejected';
    await request.save();

    await logAction(req.user._id, 'super_admin', '', '', `REJECTED_COLLEGE_REQUEST: ${request.collegeName}`, req);
    res.status(200).json({ message: 'College onboarding request rejected.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 6. SUPPORT TICKETS LIFECYCLE
// =============================================================
const getSupportTickets = async (req, res) => {
  try {
    const list = await SupportTicket.find({}).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createSupportTicket = async (req, res) => {
  try {
    const { collegeCode, title, description, category, priority } = req.body;
    const ticketId = `TCK-${Date.now().toString().slice(-6)}`;

    const ticket = await SupportTicket.create({
      ticketId,
      collegeCode: (collegeCode || 'GLOBAL').toUpperCase(),
      title: title || 'System Technical Request',
      description: description || '',
      category: category || 'Technical',
      priority: priority || 'Medium',
      status: 'Open',
      createdBy: req.user._id,
      creatorName: req.user.fullName
    });

    res.status(201).json({ message: 'Support ticket created.', ticket });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const replySupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Reply message required.' });

    const ticket = await SupportTicket.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    ticket.replies.push({
      senderId: req.user._id,
      senderName: req.user.fullName,
      senderRole: req.user.role,
      message,
      createdAt: new Date()
    });

    ticket.status = 'In Progress';
    await ticket.save();

    res.status(200).json({ message: 'Reply added.', ticket });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const resolveSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await SupportTicket.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    ticket.status = ticket.status === 'Resolved' ? 'Open' : 'Resolved';
    await ticket.save();

    res.status(200).json({ message: `Ticket status set to ${ticket.status}.`, ticket });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 7. ONBOARDING LEADS PIPELINE
// =============================================================
const getLeads = async (req, res) => {
  try {
    const list = await Lead.find({}).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createLead = async (req, res) => {
  try {
    const lead = await Lead.create(req.body);
    res.status(201).json({ message: 'Lead added to pipeline.', lead });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const lead = await Lead.findByIdAndUpdate(id, { status }, { new: true });
    res.status(200).json({ message: 'Lead status updated.', lead });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addLeadNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });

    lead.notes.push({
      author: req.user.fullName,
      text,
      createdAt: new Date()
    });
    await lead.save();

    res.status(200).json({ message: 'Follow-up note added.', lead });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    await Lead.findByIdAndDelete(id);
    res.status(200).json({ message: 'Lead deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 8. BILLING & SUBSCRIPTIONS
// =============================================================
const createSubscriptionPlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.create(req.body);
    res.status(201).json({ message: 'SaaS plan created.', plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSubscriptionPlans = async (req, res) => {
  try {
    const list = await SubscriptionPlan.find({});
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getInvoices = async (req, res) => {
  try {
    const list = await Invoice.find({}).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 9. SYSTEM CONFIG, PROFILE & AUDIT LOGS
// =============================================================
const searchAuditLogs = async (req, res) => {
  try {
    const list = await AuditLog.find({}).sort({ createdAt: -1 }).limit(100);
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }
    await user.save();

    res.status(200).json({ message: 'Super Admin profile updated.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const broadcastNotification = async (req, res) => {
  try {
    const { title, message } = req.body;
    notifySocket(req, 'GLOBAL_BROADCAST', { title, message, date: new Date() });
    res.status(200).json({ message: 'Broadcast dispatched to all connected sockets.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getSaaSStats,
  registerFullCollege,
  addMasterCollege,
  getAllColleges,
  getCollegeDetails,
  updateCollege,
  deleteCollege,
  toggleCollegeStatus,
  getAllPlatformUsers,
  resetUserPassword,
  toggleUserAccount,
  deleteUserAccount,
  approveRequest,
  rejectRequest,
  getSupportTickets,
  createSupportTicket,
  replySupportTicket,
  resolveSupportTicket,
  getLeads,
  createLead,
  updateLeadStatus,
  addLeadNote,
  deleteLead,
  createSubscriptionPlan,
  getSubscriptionPlans,
  getInvoices,
  searchAuditLogs,
  updateProfile,
  broadcastNotification
};
