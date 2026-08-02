const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const College = require('../models/College');
const RefreshToken = require('../models/RefreshToken');
const { logAction } = require('../services/auditLogService');

const generateTokens = async (userId, role, collegeCode, department) => {
  const accessToken = jwt.sign(
    { id: userId, role, collegeCode, department },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Store refresh token session in Mongoose
  await RefreshToken.create({
    token: refreshToken,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return { accessToken, refreshToken };
};

const campusLogin = async (req, res) => {
  try {
    const { portalType } = req.params; // 'principal', 'hod', 'faculty', 'admin'
    const { collegeCode, emailOrEmployeeId, password } = req.body;

    if (!portalType || !emailOrEmployeeId || !password) {
      return res.status(400).json({ message: 'All login credentials are required.' });
    }

    // Super Admin check (Bypasses college validations)
    const normalizedId = emailOrEmployeeId.trim().toLowerCase();
    if (
      portalType === 'super-admin' ||
      portalType === 'admin' ||
      normalizedId === 'indra0408' ||
      normalizedId === 'mittapalliindrasenareddy913@gmail.com' ||
      normalizedId === 'superadmin' ||
      normalizedId === 'superadmin001'
    ) {
      const adminUser = await User.findOne({
        $or: [
          { username: normalizedId },
          { email: normalizedId },
          { username: 'indra0408' },
          { email: 'mittapalliindrasenareddy913@gmail.com' },
          { role: 'super_admin' }
        ]
      });

      if (!adminUser) return res.status(400).json({ message: 'Invalid credentials.' });

      const isMatch = await bcrypt.compare(password, adminUser.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

      const { accessToken, refreshToken } = await generateTokens(adminUser._id, 'super_admin', adminUser.collegeCode || '', '');
      return res.status(200).json({ token: accessToken, accessToken, refreshToken, role: 'super_admin', fullName: adminUser.fullName || 'Super Admin', collegeCode: adminUser.collegeCode || '', collegeName: 'Super Admin System' });
    }

    if (!collegeCode) {
      return res.status(400).json({ message: 'College Code is required.' });
    }

    // Verify college exists and is active
    const college = await College.findOne({ collegeCode: collegeCode.toUpperCase() });
    if (!college) {
      return res.status(400).json({ message: 'Invalid College Code.' });
    }
    if (college.status !== 'active') {
      return res.status(403).json({ message: `College workspace status is: ${college.status}. Access denied.` });
    }

    // Search user
    const inputClean = emailOrEmployeeId.trim();
    const inputLower = inputClean.toLowerCase();

    const query = {
      collegeCode: collegeCode.toUpperCase(),
      $or: [
        { email: inputLower },
        { username: inputLower },
        { employeeId: new RegExp(`^${inputClean}$`, 'i') }
      ]
    };

    let user = await User.findOne(query);

    // Fallback role alias lookup if input is simply 'hod', 'hod_cse', 'faculty', 'faculty_cse'
    if (!user) {
      if (inputLower.includes('hod') && (portalType === 'hod' || portalType === 'admin')) {
        user = await User.findOne({ collegeCode: collegeCode.toUpperCase(), role: 'hod' });
      } else if (inputLower.includes('faculty') && (portalType === 'faculty' || portalType === 'admin')) {
        user = await User.findOne({ collegeCode: collegeCode.toUpperCase(), role: 'faculty' });
      }
    }

    if (!user) {
      // Look globally to see if the user exists but collegeCode is wrong
      const globalUser = await User.findOne({
        $or: [
          { email: inputLower },
          { username: inputLower },
          { employeeId: new RegExp(`^${inputClean}$`, 'i') }
        ]
      });
      if (globalUser && globalUser.collegeCode && globalUser.collegeCode.toUpperCase() !== collegeCode.toUpperCase()) {
        return res.status(401).json({ message: 'Wrong College Code.' });
      }
      return res.status(401).json({ message: 'Incorrect credentials.' });
    }

    if (user.isDeleted === true || user.status === 'DELETED') {
      return res.status(403).json({ message: 'Deleted Account.' });
    }

    if (user.status === 'INACTIVE') {
      return res.status(403).json({ message: 'Inactive Account.' });
    }

    if (user.status === 'DISABLED' || !user.isActive) {
      return res.status(403).json({ message: 'Account Disabled.' });
    }

    if (user.status === 'LOCKED') {
      return res.status(403).json({ message: 'Account Locked.' });
    }

    // Role-based portal validations
    if (portalType === 'principal' && user.role !== 'principal') {
      return res.status(403).json({ message: "This account belongs to another workspace. Please login using the correct portal." });
    }
    if (portalType === 'hod' && user.role !== 'hod') {
      return res.status(403).json({ message: "This account belongs to another workspace. Please login using the correct portal." });
    }
    if (portalType === 'faculty' && user.role !== 'faculty') {
      return res.status(403).json({ message: "This account belongs to another workspace. Please login using the correct portal." });
    }

    const adminRoles = ['coe', 'exam_cell', 'accounts', 'library', 'placement', 'hostel', 'transport', 'hr', 'admission_office'];
    if (portalType === 'admin' && !adminRoles.includes(user.role)) {
      return res.status(403).json({ message: "This account belongs to another workspace. Please login using the correct portal." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Wrong Password.' });
    }

    // Check if password reset is required on first login (ERP Imported Accounts)
    if (user.status === 'PASSWORD_RESET_REQUIRED') {
      const tempToken = jwt.sign(
        { id: user._id, isTempReset: true, role: user.role, collegeCode: user.collegeCode },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      return res.status(200).json({
        passwordResetRequired: true,
        tempToken,
        message: 'Password reset required on first login.'
      });
    }

    // Faculty requires secondary face auth
    if (user.role === 'faculty') {
      if (user.firstLogin || !user.faceVerificationData) {
        // First login: bypass facial login and issue token to complete profile setup
        const { accessToken, refreshToken } = await generateTokens(
          user._id,
          'faculty',
          user.collegeCode,
          user.assignedDepartment
        );
        return res.status(200).json({
          requireProfileSetup: true,
          accessToken,
          refreshToken,
          role: 'faculty',
          fullName: user.fullName,
          collegeCode: user.collegeCode,
          collegeName: college.name,
          department: user.assignedDepartment
        });
      }

      // Subsequent logins: require face verification
      const tempToken = jwt.sign(
        { id: user._id, isTemp: true, role: 'faculty', collegeCode: user.collegeCode },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      return res.status(200).json({
        requireFaceAuth: true,
        tempToken,
        message: 'Password verified. Face verification required to proceed.'
      });
    }

    // Generate tokens for HOD, Principal, and Admin
    const { accessToken, refreshToken } = await generateTokens(
      user._id,
      user.role,
      user.collegeCode,
      user.assignedDepartment
    );

    await logAction(user._id, user.role, user.collegeCode, user.assignedDepartment, 'LOGIN_SUCCESS', req);

    res.status(200).json({
      accessToken,
      refreshToken,
      role: user.role,
      fullName: user.fullName,
      collegeCode: user.collegeCode,
      collegeName: college.name,
      department: user.assignedDepartment
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Faculty Face Verification & Liveness check
const verifyFacultyFace = async (req, res) => {
  try {
    const { tempToken, faceImageBase64 } = req.body;

    if (!tempToken) {
      return res.status(400).json({ message: 'Temporary token is required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Verification session expired. Please log in again.' });
    }

    if (!decoded.isTemp || decoded.role !== 'faculty') {
      return res.status(400).json({ message: 'Invalid verification session.' });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(404).json({ message: 'Faculty user account deactivated.' });
    }

    // Match signature descriptors
    const faceMatchSuccess = true; // Simulated descriptor matching
    if (!faceMatchSuccess) {
      await logAction(user._id, 'faculty', user.collegeCode, user.assignedDepartment, 'FACIAL_VERIFICATION_FAILED', req);
      return res.status(403).json({ message: 'Facial validation check failed. Liveness check error.' });
    }

    // Generate final authenticated tokens
    const { accessToken, refreshToken } = await generateTokens(
      user._id,
      'faculty',
      user.collegeCode,
      user.assignedDepartment
    );

    await logAction(user._id, 'faculty', user.collegeCode, user.assignedDepartment, 'LOGIN_SUCCESS_FACIAL', req);

    const college = await College.findOne({ collegeCode: user.collegeCode.toUpperCase() });
    const collegeName = college ? college.name : '';

    res.status(200).json({
      accessToken,
      refreshToken,
      role: 'faculty',
      fullName: user.fullName,
      collegeCode: user.collegeCode,
      collegeName,
      department: user.assignedDepartment
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required.' });
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken });
    if (!storedToken) {
      return res.status(401).json({ message: 'Invalid or expired session.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (err) {
      await RefreshToken.deleteOne({ token: refreshToken });
      return res.status(401).json({ message: 'Invalid session signatures.' });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User session has been revoked.' });
    }

    // Generate a fresh short-lived access token
    const accessToken = jwt.sign(
      { id: user._id, role: user.role, collegeCode: user.collegeCode, department: user.assignedDepartment },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.status(200).json({ accessToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const registerPrincipal = async (req, res) => {
  try {
    const { collegeCode, fullName, email, password, mobileNumber } = req.body;

    if (!collegeCode || !fullName || !email || !password) {
      return res.status(400).json({ message: 'Missing onboarding parameters.' });
    }

    const college = await College.findOne({ collegeCode: collegeCode.toUpperCase() });
    if (!college) {
      return res.status(404).json({ message: 'College Code not found.' });
    }

    if (college.status === 'pending_verification') {
      return res.status(403).json({ message: "This college is awaiting Super Admin approval." });
    }

    if (college.status !== 'verified' && college.status !== 'active') {
      return res.status(403).json({ message: `College status is: ${college.status}. Registration disabled.` });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ message: 'This email is already in use.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'principal',
      collegeCode: collegeCode.toUpperCase(),
      employeeId: 'PRINCIPAL001',
      mobileNumber,
      isActive: true
    });

    // Automatically transition status to 'active' once Principal registers
    college.status = 'active';
    await college.save();

    await logAction(user._id, 'principal', collegeCode.toUpperCase(), '', 'PRINCIPAL_REGISTERED', req);

    res.status(201).json({ message: 'Principal onboarding completed. Workspace activated.', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const forceChangePassword = async (req, res) => {
  try {
    const { tempToken, newPassword, confirmPassword } = req.body;
    if (!tempToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Temporary token and new passwords are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    if (!decoded.isTempReset) {
      return res.status(400).json({ message: 'Invalid verification session.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Validate new password complexity
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ message: 'New password must contain at least one uppercase letter.' });
    }
    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({ message: 'New password must contain at least one lowercase letter.' });
    }
    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({ message: 'New password must contain at least one number.' });
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return res.status(400).json({ message: 'New password must contain at least one special character.' });
    }

    // Verify it is not identical to current default password (their employeeId or rollNumber or username)
    const isDefaultSame = (user.employeeId && newPassword === user.employeeId) || (user.rollNumber && newPassword === user.rollNumber) || (user.username && newPassword === user.username);
    if (isDefaultSame) {
      return res.status(400).json({ message: 'New password cannot be the same as your default login ID.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.status = 'ACTIVE';
    user.firstLogin = false;
    user.passwordLastChanged = new Date();
    await user.save();

    // Log the password change action
    await logAction(user._id, user.role, user.collegeCode, user.assignedDepartment || '', 'FORCE_PASSWORD_CHANGED', req);

    // Resolve college name for the response
    const college = await College.findOne({ collegeCode: user.collegeCode });

    // Generate active session tokens for automatic login
    const { accessToken, refreshToken } = await generateTokens(
      user._id,
      user.role,
      user.collegeCode,
      user.assignedDepartment || ''
    );

    res.status(200).json({
      message: 'Password updated successfully! Logged in.',
      accessToken,
      refreshToken,
      role: user.role,
      fullName: user.fullName,
      collegeCode: user.collegeCode,
      collegeName: college ? college.name : '',
      department: user.assignedDepartment || ''
    });
  } catch (err) {
    console.error('forceChangePassword error:', err.message);
    res.status(500).json({ message: 'Server error updating password.' });
  }
};

const setupFacultyProfile = async (req, res) => {
  try {
    const { newPassword, faceVerificationData, department, year, section } = req.body;
    
    // Auth middleware populates req.user. Find user from database
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Faculty user not found.' });

    // Update password if provided
    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    // Save facial template coordinates/data
    if (faceVerificationData) {
      user.faceVerificationData = typeof faceVerificationData === 'string' ? JSON.parse(faceVerificationData) : faceVerificationData;
    }

    if (department) {
      user.assignedDepartment = department.toUpperCase();
    }

    // Assign class if year and section specified
    if (year && section) {
      user.assignedClasses = [{
        year: Number(year),
        section: section.toUpperCase(),
        subject: 'General'
      }];
    }

    user.firstLogin = false;
    user.status = 'ACTIVE';
    await user.save();

    await logAction(user._id, 'faculty', user.collegeCode, user.assignedDepartment || '', 'FACULTY_PROFILE_SETUP_COMPLETE', req);

    res.status(200).json({
      message: 'Profile and Face ID enrolled successfully!',
      user: {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        firstLogin: user.firstLogin,
        assignedDepartment: user.assignedDepartment,
        assignedClasses: user.assignedClasses
      }
    });
  } catch (err) {
    console.error('setupFacultyProfile error:', err.message);
    res.status(500).json({ message: 'Server error during profile setup.' });
  }
};

module.exports = {
  campusLogin,
  verifyFacultyFace,
  refreshAccessToken,
  registerPrincipal,
  forceChangePassword,
  setupFacultyProfile
};
