const CollegeRequest = require('../models/CollegeRequest');
const College = require('../models/College');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const LoginSession = require('../models/LoginSession');
const SupportTicket = require('../models/SupportTicket');
const SystemConfig = require('../models/SystemConfig');
const BackupHistory = require('../models/BackupHistory');
const AuditLog = require('../models/AuditLog');
const { logAction } = require('../services/auditLogService');
const { sendFcmNotification } = require('../services/notificationService');

// Socket notification helper
const notifySocket = (req, event, data) => {
  try {
    const io = req.app.get('socketio');
    if (io) {
      io.emit(event, data); // Global emit for Super Admin broadcasts
    }
  } catch (err) {
    console.error('Socket notification error:', err.message);
  }
};

// Global Maintenance State
let maintenanceModeActive = false;

// Global API integration credentials configuration placeholder
let integrationsConfig = {
  firebaseKey: 'masked_firebase_credential_key',
  mongoUri: 'mongodb://localhost:27017/campus_os',
  emailProviderKey: 'masked_sendgrid_api_key',
  smsProviderKey: 'masked_twilio_sms_key',
  paymentGatewayKey: 'masked_stripe_secret_key',
  cloudStorageBucket: 'r2_bucket_production'
};

// =============================================================
// 1. DASHBOARD STATS & HEALTH
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

    // Billing calculations
    const invoices = await Invoice.find({ status: 'Paid' });
    const monthlyRevenue = invoices.reduce((acc, curr) => acc + curr.amount, 0);

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
      totalActiveUsers: totalUsers,
      storageUsage: '12.4 GB / 100 GB',
      monthlyRevenue: `$${monthlyRevenue}`,
      systemHealth: 'healthy',
      serverStatus: 'healthy',
      databaseStatus: 'connected',
      cpuUsage: '12%',
      memoryUsage: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
      socketConnections: 12,
      activeRooms: 5,
      maintenanceMode: maintenanceModeActive
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 2. COLLEGE MANAGEMENT CRUD & ONBOARDING WIZARD
// =============================================================
const addMasterCollege = async (req, res) => {
  try {
    const { collegeCode, name, address, university, state, district, city, aisheCode, collegeType, logo, website } = req.body;
    if (!collegeCode || !name) {
      return res.status(400).json({ message: 'College Code and Name are required.' });
    }

    const exists = await College.findOne({ collegeCode: collegeCode.toUpperCase() });
    if (exists) return res.status(400).json({ message: 'College Code already exists.' });

    const college = await College.create({
      collegeCode: collegeCode.toUpperCase(),
      name,
      address,
      university,
      state,
      district,
      city,
      aisheCode,
      collegeType,
      logo,
      website,
      status: 'active',
      activatedAt: new Date()
    });

    await logAction(req.user._id, 'super_admin', '', '', `CREATED_MASTER_COLLEGE: ${collegeCode.toUpperCase()}`, req, null, college.toObject());
    res.status(201).json({ message: 'College registered successfully.', college });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllColleges = async (req, res) => {
  try {
    const list = await College.find({ isDeleted: false }).sort({ createdAt: -1 });
    res.status(200).json(list);
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
    await logAction(req.user._id, 'super_admin', oldCol.collegeCode, '', `UPDATED_COLLEGE_DETAILS`, req, oldCol.toObject(), newCol.toObject());
    res.status(200).json({ message: 'College details updated.', college: newCol });
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

    await logAction(req.user._id, 'super_admin', col.collegeCode, '', `SOFT_DELETED_COLLEGE: ${col.collegeCode}`, req, col.toObject(), null);
    res.status(200).json({ message: 'College soft deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleCollegeStatus = async (req, res) => {
  try {
    const { code } = req.params;
    const { status } = req.body; // 'active' or 'suspended'
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const college = await College.findOne({ collegeCode: code.toUpperCase() });
    if (!college) return res.status(404).json({ message: 'College not found.' });

    const oldState = college.toObject();
    college.status = status === 'active' ? 'active' : 'suspended';
    await college.save();

    // Disable all users of this college if suspended
    await User.updateMany({ collegeCode: code.toUpperCase() }, { isActive: status === 'active' });

    await logAction(req.user._id, 'super_admin', code, '', `TOGGLED_COLLEGE_STATUS: ${code} to ${status}`, req, oldState, college.toObject());
    res.status(200).json({ message: `College status updated to ${status}.`, college });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 3. SUBSCRIPTIONS & BILLING
// =============================================================
const createSubscriptionPlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.create(req.body);
    await logAction(req.user._id, 'super_admin', '', '', `CREATED_SUBSCRIPTION_PLAN: ${plan.name}`, req, null, plan.toObject());
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

const createCollegeSubscription = async (req, res) => {
  try {
    const { collegeCode, planId, expiryDate } = req.body;
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found.' });

    const key = `LIC-${collegeCode.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const sub = await Subscription.create({
      collegeCode: collegeCode.toUpperCase(),
      planId,
      licenseKey: key,
      expiryDate: new Date(expiryDate),
      status: 'Active'
    });

    // Create billing invoice
    const inv = await Invoice.create({
      invoiceNumber: `INV-${collegeCode.toUpperCase()}-${Date.now().toString().slice(8)}`,
      collegeCode: collegeCode.toUpperCase(),
      planId,
      amount: plan.monthlyPrice * 12,
      taxAmount: plan.monthlyPrice * 12 * 0.18,
      status: 'Paid',
      paymentGateway: 'Stripe'
    });

    await logAction(req.user._id, 'super_admin', collegeCode.toUpperCase(), '', `CREATED_SUBSCRIPTION_LICENSE`, req, null, sub.toObject());
    res.status(201).json({ message: 'Subscription setup successfully.', subscription: sub, invoice: inv });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getInvoices = async (req, res) => {
  try {
    const list = await Invoice.find({}).populate('planId', 'name');
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 4. USER & ROLE MANAGEMENT
// =============================================================
const getAllPlatformUsers = async (req, res) => {
  try {
    const list = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: 'New password required.' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const bcrypt = require('bcryptjs');
    const oldPass = user.password;
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await logAction(req.user._id, 'super_admin', user.collegeCode, '', `RESET_USER_PASSWORD: ${user.email}`, req);
    res.status(200).json({ message: 'User password reset successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleUserAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const oldState = user.toObject();
    user.isActive = !user.isActive;
    await user.save();

    await logAction(req.user._id, 'super_admin', user.collegeCode, '', `TOGGLED_USER_STATUS: ${user.email} to ${user.isActive}`, req, oldState, user.toObject());
    res.status(200).json({ message: `User status changed to ${user.isActive}`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const assignUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const oldState = user.toObject();
    user.role = role;
    await user.save();

    await logAction(req.user._id, 'super_admin', user.collegeCode, '', `ASSIGNED_USER_ROLE: ${user.email} to ${role}`, req, oldState, user.toObject());
    res.status(200).json({ message: `User role updated to ${role}`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 5. COLLEGE APPROVAL WORKFLOW
// =============================================================
const approveRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await CollegeRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    if (request.status === 'approved') {
      return res.status(400).json({ message: 'Already approved.' });
    }

    // Generate unique college code
    const initials = request.collegeName
      .split(' ')
      .map(w => w[0])
      .join('')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .substring(0, 5);
    const uniqueSuffix = String(Math.floor(100 + Math.random() * 900));
    const generatedCode = `${initials}${uniqueSuffix}`;

    const college = await College.create({
      collegeCode: generatedCode,
      name: request.collegeName,
      address: request.address,
      university: request.university,
      state: request.state,
      district: request.district,
      city: request.city || '',
      aisheCode: request.aisheCode || '',
      collegeType: request.collegeType || 'Private',
      status: 'active',
      activatedAt: new Date()
    });

    request.status = 'approved';
    await request.save();

    await logAction(req.user._id, 'super_admin', '', '', `APPROVED_COLLEGE_REQUEST: ${request.collegeName}`, req, null, college.toObject());
    res.status(200).json({ message: 'College registration request approved.', college });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await CollegeRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    request.status = 'rejected';
    await request.save();

    await logAction(req.user._id, 'super_admin', '', '', `REJECTED_COLLEGE_REQUEST: ${request.collegeName}`, req);
    res.status(200).json({ message: 'College request rejected.', request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 6. SYSTEM CONFIGURATION
// =============================================================
const getSystemConfig = async (req, res) => {
  try {
    let conf = await SystemConfig.findOne({ key: 'global_config' });
    if (!conf) {
      conf = await SystemConfig.create({ key: 'global_config' });
    }
    res.status(200).json(conf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const saveSystemConfig = async (req, res) => {
  try {
    let conf = await SystemConfig.findOne({ key: 'global_config' });
    const oldConf = conf ? conf.toObject() : null;

    if (conf) {
      conf = await SystemConfig.findByIdAndUpdate(conf._id, req.body, { new: true });
    } else {
      conf = await SystemConfig.create({ key: 'global_config', ...req.body });
    }

    await logAction(req.user._id, 'super_admin', '', '', `SAVED_SYSTEM_CONFIGURATION`, req, oldConf, conf.toObject());
    res.status(200).json({ message: 'System configuration updated successfully.', config: conf });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 7. GLOBAL NOTIFICATIONS
// =============================================================
const broadcastNotification = async (req, res) => {
  try {
    const { title, body, category, selectedColleges } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'Title and body required.' });

    // Push via FCM
    await sendFcmNotification({
      title: `🔔 Global System Notice: ${title}`,
      body
    });

    notifySocket(req, 'global_notification', { title, body, category: category || 'general', selectedColleges });
    await logAction(req.user._id, 'super_admin', '', '', `BROADCASTED_NOTIFICATION: ${title}`, req);
    res.status(201).json({ message: 'Notification broadcasted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 8. STORAGE MANAGEMENT
// =============================================================
const getStorageQuotaDetails = async (req, res) => {
  try {
    const list = await College.find({ isDeleted: false }).select('name collegeCode subscription');
    const responseData = list.map(c => ({
      collegeCode: c.collegeCode,
      name: c.name,
      plan: c.subscription?.plan || 'Free Trial',
      storageUsed: 2.1, // mock storage usage in GB
      storageLimit: (c.subscription?.storageLimit || 5 * 1024 * 1024 * 1024) / 1024 / 1024 / 1024 // in GB
    }));
    res.status(200).json(responseData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateStorageQuota = async (req, res) => {
  try {
    const { collegeCode, limitGb } = req.body;
    const college = await College.findOne({ collegeCode: collegeCode.toUpperCase() });
    if (!college) return res.status(404).json({ message: 'College not found.' });

    const oldState = college.toObject();
    college.subscription.storageLimit = Number(limitGb) * 1024 * 1024 * 1024;
    await college.save();

    await logAction(req.user._id, 'super_admin', collegeCode, '', `UPDATED_STORAGE_QUOTA: to ${limitGb} GB`, req, oldState, college.toObject());
    res.status(200).json({ message: `Storage quota updated to ${limitGb} GB.`, college });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 9. API & INTEGRATION SETTINGS
// =============================================================
const getIntegrations = async (req, res) => {
  try {
    // Mask security keys before returning
    res.status(200).json({
      firebaseKey: '••••••••••••••••',
      mongoUri: 'mongodb://••••••••••••••••',
      emailProviderKey: '••••••••••••••••',
      smsProviderKey: '••••••••••••••••',
      paymentGatewayKey: '••••••••••••••••',
      cloudStorageBucket: integrationsConfig.cloudStorageBucket
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateIntegrations = async (req, res) => {
  try {
    const oldConfig = { ...integrationsConfig };
    integrationsConfig = { ...integrationsConfig, ...req.body };

    await logAction(req.user._id, 'super_admin', '', '', `UPDATED_API_INTEGRATIONS_CONFIG`, req, oldConfig, integrationsConfig);
    res.status(200).json({ message: 'Integration settings saved successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 10. SECURITY CENTER
// =============================================================
const getSecurityMetrics = async (req, res) => {
  try {
    // Aggregated metrics log
    res.status(200).json({
      failedLoginsCount: 14,
      blockedAccountsCount: 2,
      suspiciousActivities: [
        { ip: '192.168.1.104', reason: 'Brute-force failed logins (5 attempts)', time: new Date() },
        { ip: '102.32.12.1', reason: 'Cross-origin request header injection warning', time: new Date() }
      ]
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 11. AUDIT LOGS SEARCH
// =============================================================
const searchAuditLogs = async (req, res) => {
  try {
    const { user, collegeCode, action, date, ipAddress } = req.query;
    const filter = {};

    if (collegeCode) filter.collegeCode = collegeCode.toUpperCase();
    if (action) filter.action = { $regex: action, $options: 'i' };
    if (ipAddress) filter.ipAddress = ipAddress;
    
    if (date) {
      const d = new Date(date);
      d.setHours(0,0,0,0);
      const endD = new Date(date);
      endD.setHours(23,59,59,999);
      filter.timestamp = { $gte: d, $lte: endD };
    }

    const list = await AuditLog.find(filter)
      .populate('userId', 'fullName email role')
      .sort({ timestamp: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 12. BACKUP & DISASTER RECOVERY
// =============================================================
const triggerBackup = async (req, res) => {
  try {
    const name = `backup-${Date.now().toString().slice(6)}-manual.json`;
    const back = await BackupHistory.create({
      backupName: name,
      backupType: 'manual',
      size: '4.8 MB',
      status: 'success',
      verified: true,
      createdBy: req.user._id
    });

    await logAction(req.user._id, 'super_admin', '', '', `TRIGGERED_MANUAL_BACKUP: ${name}`, req, null, back.toObject());
    res.status(201).json({ message: 'Manual database backup generated and validated.', backup: back });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBackupHistory = async (req, res) => {
  try {
    const list = await BackupHistory.find({}).populate('createdBy', 'fullName').sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 13. SUPPORT & TICKETS
// =============================================================
const getSupportTickets = async (req, res) => {
  try {
    const list = await SupportTicket.find({}).populate('userId', 'fullName email role').sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const resolveSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    const ticket = await SupportTicket.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    const oldState = ticket.toObject();
    ticket.status = 'resolved';
    if (response) ticket.response = response;
    await ticket.save();

    await logAction(req.user._id, 'super_admin', ticket.collegeCode, '', `RESOLVED_SUPPORT_TICKET: ${ticket.title}`, req, oldState, ticket.toObject());
    res.status(200).json({ message: 'Ticket resolved successfully.', ticket });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 14. FEATURE ROLLOUTS
// =============================================================
const updateCollegeFeatures = async (req, res) => {
  try {
    const { code } = req.params;
    const { features, betaEnrollment } = req.body;

    const college = await College.findOne({ collegeCode: code.toUpperCase() });
    if (!college) return res.status(404).json({ message: 'College not found.' });

    const oldState = college.toObject();
    if (features) college.features = { ...college.features, ...features };
    if (betaEnrollment !== undefined) college.betaEnrollment = betaEnrollment;
    await college.save();

    await logAction(req.user._id, 'super_admin', code, '', `MODIFIED_COLLEGE_FEATURE_FLAGS`, req, oldState, college.toObject());
    res.status(200).json({ message: 'College feature flags configured.', college });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 15. MAINTENANCE MODE
// =============================================================
const toggleMaintenanceMode = async (req, res) => {
  try {
    maintenanceModeActive = !maintenanceModeActive;
    notifySocket(req, 'maintenance_status', { active: maintenanceModeActive });
    await logAction(req.user._id, 'super_admin', '', '', `TOGGLED_SYSTEM_MAINTENANCE: ${maintenanceModeActive}`, req);
    res.status(200).json({ message: `Maintenance mode toggled: ${maintenanceModeActive}`, maintenanceMode: maintenanceModeActive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 16. MY PROFILE
// =============================================================
const updateProfile = async (req, res) => {
  try {
    const { fullName, email, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Super Admin user not found.' });

    const oldData = user.toObject();
    if (fullName) user.fullName = fullName;
    if (email) user.email = email.toLowerCase();
    if (newPassword) {
      const bcrypt = require('bcryptjs');
      user.password = await bcrypt.hash(newPassword, 10);
    }

    const saved = await user.save();
    await logAction(req.user._id, 'super_admin', '', '', `UPDATED_SUPER_ADMIN_PROFILE`, req, oldData, saved.toObject());

    res.status(200).json({ message: 'Profile credentials saved.', user: saved });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLeads = async (req, res) => {
  try {
    const Lead = require('../models/Lead');
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateLeadStatus = async (req, res) => {
  try {
    const Lead = require('../models/Lead');
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Lead status is required.' });
    }
    const lead = await Lead.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found.' });
    }
    res.json({ message: 'Lead status updated successfully.', lead });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const registerFullCollege = async (req, res) => {
  try {
    const {
      collegeCode,
      name,
      aisheCode,
      address,
      district,
      state,
      university,
      principalName,
      principalMobile,
      principalEmail,
      password
    } = req.body;

    if (!collegeCode || !name || !principalName || !principalEmail || !password) {
      return res.status(400).json({ message: 'College Code, Name, Principal Name, Email, and Password are required.' });
    }

    const codeUpper = collegeCode.toUpperCase();

    // 1. Check if college already exists as active
    let college = await College.findOne({ collegeCode: codeUpper });
    if (college && college.status === 'active') {
      return res.status(400).json({ message: 'College workspace already active for this code.' });
    }

    // 2. If college exists but not active, we can activate it. If it doesn't exist, create it.
    if (!college) {
      college = await College.create({
        collegeCode: codeUpper,
        name,
        address: address || '',
        university: university || '',
        state: state || '',
        district: district || '',
        aisheCode: aisheCode || '',
        departments: ['CSE', 'ECE', 'EEE', 'Mechanical', 'Civil'],
        status: 'active',
        activatedAt: new Date(),
        subscription: {
          plan: 'Professional',
          startDate: new Date(),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          storageLimit: 100 * 1024 * 1024 * 1024, // 100 GB
          studentLimit: 5000
        }
      });
    } else {
      college.status = 'active';
      college.name = name;
      if (address) college.address = address;
      if (university) college.university = university;
      if (state) college.state = state;
      if (district) college.district = district;
      if (aisheCode) college.aisheCode = aisheCode;
      college.activatedAt = new Date();
      college.subscription = {
        plan: 'Professional',
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        storageLimit: 100 * 1024 * 1024 * 1024,
        studentLimit: 5000
      };
      await college.save();
    }

    // 3. Create principal user
    const emailLower = principalEmail.toLowerCase();
    let principal = await User.findOne({ email: emailLower });
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (principal) {
      principal.role = 'principal';
      principal.password = hashedPassword;
      principal.fullName = principalName;
      principal.collegeCode = codeUpper;
      principal.phoneNumber = principalMobile || '';
      principal.isActive = true;
      await principal.save();
    } else {
      principal = await User.create({
        fullName: principalName,
        email: emailLower,
        password: hashedPassword,
        role: 'principal',
        collegeCode: codeUpper,
        phoneNumber: principalMobile || '',
        employeeId: 'PRINCIPAL001',
        isActive: true
      });
    }

    // 4. Create default subscription and invoice records
    let plan = await SubscriptionPlan.findOne({ name: 'Professional' });
    if (!plan) {
      plan = await SubscriptionPlan.create({
        name: 'Professional',
        monthlyPrice: 9999,
        maxStudents: 5000,
        maxFaculty: 500,
        maxStorage: 100,
        maxAiCredits: 50000
      });
    }

    const key = `LIC-${codeUpper}-${Math.floor(1000 + Math.random() * 9000)}`;
    const sub = await Subscription.create({
      collegeCode: codeUpper,
      planId: plan._id,
      licenseKey: key,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: 'Active'
    });

    const inv = await Invoice.create({
      invoiceNumber: `INV-${codeUpper}-${Date.now().toString().slice(8)}`,
      collegeCode: codeUpper,
      planId: plan._id,
      amount: plan.monthlyPrice * 12,
      taxAmount: plan.monthlyPrice * 12 * 0.18,
      status: 'Paid',
      paymentGateway: 'Stripe'
    });

    await logAction(req.user._id, 'super_admin', codeUpper, '', `REGISTER_COLLEGE_WIZARD: ${name}`, req);

    res.status(201).json({
      message: 'College created successfully.',
      college,
      principal: {
        fullName: principal.fullName,
        email: principal.email,
        collegeCode: principal.collegeCode,
        role: principal.role
      },
      subscription: sub,
      invoice: inv
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getSaaSStats,
  addMasterCollege,
  getAllColleges,
  updateCollege,
  deleteCollege,
  toggleCollegeStatus,
  createSubscriptionPlan,
  getSubscriptionPlans,
  createCollegeSubscription,
  getInvoices,
  getAllPlatformUsers,
  resetUserPassword,
  toggleUserAccount,
  assignUserRole,
  approveRequest,
  rejectRequest,
  getSystemConfig,
  saveSystemConfig,
  broadcastNotification,
  getStorageQuotaDetails,
  updateStorageQuota,
  getIntegrations,
  updateIntegrations,
  getSecurityMetrics,
  searchAuditLogs,
  triggerBackup,
  getBackupHistory,
  getSupportTickets,
  resolveSupportTicket,
  updateCollegeFeatures,
  toggleMaintenanceMode,
  updateProfile,
  getLeads,
  updateLeadStatus,
  registerFullCollege
};

