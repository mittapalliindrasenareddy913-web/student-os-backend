const User = require('../models/User');
const FocusSession = require('../models/FocusSession');
const Task = require('../models/Task');
const Timetable = require('../models/Timetable');
const Subject = require('../models/Attendance');
const College = require('../models/College');
const StudentRecord = require('../models/StudentRecord');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');
const generateTokens = (id) => {
  const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const refreshToken = jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '90d' });
  return { accessToken, refreshToken };
};

const sanitizeUser = (user) => ({
  _id:          user._id,
  fullName:     user.fullName,
  email:        user.email,
  username:     user.username,
  studentId:    user.studentId,
  countryCode:  user.countryCode,
  mobileNumber: user.mobileNumber,
  avatar:       user.avatar,
  coverPhoto:   user.coverPhoto,
  bio:          user.bio,
  dateOfBirth:  user.dateOfBirth,
  gender:       user.gender,
  showGender:   user.showGender,
  collegeName:  user.collegeName,
  branch:       user.branch,
  year:         user.year,
  semester:     user.semester,
  rollNumber:   user.rollNumber,
  skills:       user.skills,
  interests:    user.interests,
  location:     user.location,
  githubUrl:    user.githubUrl,
  linkedinUrl:  user.linkedinUrl,
  portfolioUrl: user.portfolioUrl,
  websiteUrl:   user.websiteUrl,
  instagramUrl: user.instagramUrl,
  xUrl:         user.xUrl,
  youtubeUrl:   user.youtubeUrl,
  telegramUrl:  user.telegramUrl,
  visibilitySettings: user.visibilitySettings,
  profileVisibility: user.profileVisibility,
  openToOpportunities: user.openToOpportunities,
  studyStreak:  user.studyStreak,
  totalFocusMinutes: user.totalFocusMinutes,
  dashboardCache: user.dashboardCache,
  settings:     user.settings,
  isGoogleLinked: user.isGoogleLinked,
  isCollegeConnected: user.isCollegeConnected,
  collegeLinked: user.collegeLinked,
  accountType:   user.accountType,
  role:          user.role || 'student',
  collegeCode:   user.collegeCode,
  section:       user.section,
  firstLogin:    user.firstLogin,
  createdAt:    user.createdAt,
});

// ── @route  POST /api/auth/register ─────────────────────────────────────
const registerUser = async (req, res) => {
  try {
    const {
      fullName, email, password, username, countryCode, mobileNumber,
      collegeCode, rollNumber, isConnected,
      manFullName, manRollNumber, manDepartment, manBranch, manAcademicYear, manSemester, manSection
    } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ message: 'Email, Username and Password are required.' });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Invalid input types.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid email address format.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{4,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ message: 'Username must be between 4 and 30 characters and contain only letters, numbers, and underscores.' });
    }

    let preRegisteredUser = null;
    let studentRec = null;
    if (isConnected && collegeCode && rollNumber) {
      studentRec = await StudentRecord.findOne({
        collegeCode: collegeCode.toUpperCase(),
        rollNumber: rollNumber.toUpperCase()
      });
      if (studentRec && studentRec.linkedUserId) {
        const u = await User.findById(studentRec.linkedUserId);
        if (u && u.status === 'PRE_REGISTERED') {
          preRegisteredUser = u;
        }
      }
    }

    if (preRegisteredUser) {
      // Uniqueness check excluding pre-registered user id
      if (await User.findOne({ username: username.toLowerCase(), _id: { $ne: preRegisteredUser._id } })) {
        return res.status(400).json({ message: 'An account with this username already exists.' });
      }
      if (await User.findOne({ email: email.toLowerCase(), _id: { $ne: preRegisteredUser._id } })) {
        return res.status(400).json({ message: 'An account with this email already exists.' });
      }
      if (mobileNumber && await User.findOne({ mobileNumber, _id: { $ne: preRegisteredUser._id } })) {
        return res.status(400).json({ message: 'An account with this mobile number already exists.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      preRegisteredUser.email = email.toLowerCase();
      preRegisteredUser.password = hashedPassword;
      preRegisteredUser.username = username.toLowerCase();
      if (mobileNumber) preRegisteredUser.mobileNumber = mobileNumber;
      if (countryCode) preRegisteredUser.countryCode = countryCode;
      preRegisteredUser.status = 'ACTIVE';
      preRegisteredUser.firstLogin = false;

      const tokens = generateTokens(preRegisteredUser._id);
      preRegisteredUser.refreshTokens = [tokens.refreshToken];
      await preRegisteredUser.save();

      return res.status(201).json({
        ...sanitizeUser(preRegisteredUser),
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    }

    if (await User.findOne({ username: username.toLowerCase() })) {
      return res.status(400).json({ message: 'An account with this username already exists.' });
    }

    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    if (mobileNumber && await User.findOne({ mobileNumber })) {
      return res.status(400).json({ message: 'An account with this mobile number already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let finalFields = {
      email: email.toLowerCase(),
      password: hashedPassword,
      username: username.toLowerCase(),
      countryCode: countryCode || '+91',
      mobileNumber,
      accountType: 'student',
      role: 'student',
      status: 'ACTIVE'
    };

    if (isConnected) {
      if (!studentRec) {
        studentRec = await StudentRecord.findOne({
          collegeCode: collegeCode.toUpperCase(),
          rollNumber: rollNumber.toUpperCase()
        });
      }

      if (!studentRec) {
        return res.status(400).json({ message: 'No official academic record found for this roll number at the specified college.' });
      }
      if (studentRec.linkedUserId) {
        return res.status(400).json({ message: 'Student record already linked to another account.' });
      }

      finalFields.fullName = studentRec.fullName;
      finalFields.collegeCode = collegeCode.toUpperCase();
      finalFields.rollNumber = studentRec.rollNumber;
      finalFields.studentId = studentRec.studentId;
      finalFields.branch = studentRec.branch;
      finalFields.year = parseInt(studentRec.academicYear.split('-')[0]) || undefined;
      finalFields.semester = studentRec.semester;
      finalFields.section = studentRec.section;
      finalFields.isCollegeConnected = true;
    } else {
      finalFields.fullName = manFullName || '';
      finalFields.collegeCode = collegeCode ? collegeCode.toUpperCase() : '';
      finalFields.rollNumber = manRollNumber || '';
      finalFields.branch = manBranch || '';
      finalFields.year = manAcademicYear ? parseInt(manAcademicYear) : undefined;
      finalFields.semester = manSemester ? parseInt(manSemester) : undefined;
      finalFields.section = manSection || '';
      finalFields.isCollegeConnected = false;
    }

    const user = await User.create(finalFields);

    if (isConnected && studentRec) {
      studentRec.linkedUserId = user._id;
      await studentRec.save();
    }

    const tokens = generateTokens(user._id);
    user.refreshTokens = [tokens.refreshToken];
    await user.save();

    res.status(201).json({
      ...sanitizeUser(user),
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    console.error('[register]', err.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ── Search Colleges ──────────────────────────────────────────────────────────
const searchColleges = async (req, res) => {
  try {
    const { query } = req.query;
    const filter = {};
    if (query) {
      filter.$or = [
        { collegeName: { $regex: query, $options: 'i' } },
        { aisheCode: { $regex: query, $options: 'i' } },
        { university: { $regex: query, $options: 'i' } },
        { district: { $regex: query, $options: 'i' } },
        { city: { $regex: query, $options: 'i' } },
        { state: { $regex: query, $options: 'i' } }
      ];
    }

    const colleges = await College.find(filter);
    
    const list = colleges.map(c => ({
      _id: c._id,
      collegeLogo: c.logo || '',
      collegeName: c.collegeName,
      aisheCode: c.aisheCode || '',
      university: c.university || '',
      district: c.district || '',
      city: c.city || '',
      state: c.state || '',
      collegeCode: c.collegeCode,
      verificationBadge: c.status === 'active' || c.status === 'approved',
      isConnected: c.status === 'active' || c.status === 'approved'
    }));

    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Verify Roll Number ────────────────────────────────────────────────────────
const verifyRollNumber = async (req, res) => {
  try {
    const { collegeCode, rollNumber } = req.body;
    if (!collegeCode || !rollNumber) {
      return res.status(400).json({ message: 'College code and Roll number are required.' });
    }

    const record = await StudentRecord.findOne({
      collegeCode: collegeCode.toUpperCase(),
      rollNumber: rollNumber.toUpperCase()
    });

    if (!record) {
      return res.status(404).json({ message: 'No official academic record found for this roll number at the specified college.' });
    }

    if (record.linkedUserId) {
      const linkedUser = await User.findById(record.linkedUserId);
      if (linkedUser && linkedUser.status !== 'PRE_REGISTERED') {
        return res.status(400).json({ message: 'An account has already been registered and linked for this roll number.' });
      }
    }

    res.status(200).json({
      fullName: record.fullName,
      department: record.department,
      branch: record.branch,
      course: record.course,
      academicYear: record.academicYear,
      semester: record.semester,
      section: record.section,
      studentId: record.studentId
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── @route  POST /api/auth/login ─────────────────────────────────────────
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email && typeof email !== 'string') {
      return res.status(400).json({ message: 'Invalid input formats.' });
    }
    if (password && typeof password !== 'string') {
      return res.status(400).json({ message: 'Invalid input formats.' });
    }

    if (!email || !password)
      return res.status(400).json({ message: 'Email/Username and password are required.' });

    const loginIdentifier = email.trim();
    const query = {
      $or: [
        { email: loginIdentifier.toLowerCase() },
        { username: loginIdentifier.toLowerCase() },
        { rollNumber: loginIdentifier.toUpperCase() }
      ]
    };
    if (req.body.collegeCode) {
      const cc = req.body.collegeCode.toUpperCase().trim();
      query.collegeCode = cc;
    }
    const user = await User.findOne(query);

    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid email, username or password.' });

    if (user.status === 'PRE_REGISTERED') {
      return res.status(403).json({ message: 'Your account is pre-registered. Please verify OTP and set your password to log in.' });
    }

    // Update last active & streak
    const now = new Date();
    const lastActive = new Date(user.lastActiveAt);
    const daysDiff = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));
    const newStreak = daysDiff === 1 ? user.studyStreak + 1
                    : daysDiff === 0 ? user.studyStreak
                    : 0;

    const tokens = generateTokens(user._id);
    
    // Add new refresh token, keep up to 5 tokens max to prevent bloat
    const updatedRefreshTokens = [...(user.refreshTokens || []), tokens.refreshToken].slice(-5);

    await User.findByIdAndUpdate(user._id, {
      lastActiveAt: now,
      studyStreak: newStreak,
      refreshTokens: updatedRefreshTokens
    });

    user.studyStreak = newStreak;

    res.json({
      ...sanitizeUser(user),
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    console.error('[login]', err.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ── @route  GET /api/auth/profile ────────────────────────────────────────
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(sanitizeUser(user));
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ── @route  PUT /api/auth/profile ────────────────────────────────────────
const updateUserProfile = async (req, res) => {
  try {
    const updates = {};
    const allowed = [
      'fullName', 'countryCode', 'mobileNumber', 'profileVisibility', 'gender', 
      'showGender', 'collegeName', 'branch', 'year', 'semester', 'rollNumber', 
      'settings', 'avatar', 'coverPhoto', 'bio', 'location', 
      'githubUrl', 'linkedinUrl', 'portfolioUrl', 'websiteUrl', 
      'instagramUrl', 'xUrl', 'youtubeUrl', 'telegramUrl',
      'accountType', 'educationLevel', 'institution', 'department', 'subjectsTeaching', 
      'experienceYears', 'qualification', 'jobStatus', 'resumeUrl', 'preferredJobRole', 
      'preferredLocation', 'openToWork', 'country', 'state', 'city', 'language', 'timezone',
      'universityBoard', 'cgpaPercentage', 'officeLocation', 'researchArea', 'publications',
      'highestQualification', 'expectedSalary', 'companyName', 'jobTitle', 'industry', 'openToMentor'
    ];
    
    const parseAndValidateUrl = (field, urlVal) => {
      if (urlVal === undefined) return undefined;
      if (!urlVal) return '';
      let cleanVal = urlVal.trim();
      if (!/^https?:\/\//i.test(cleanVal)) {
        cleanVal = 'https://' + cleanVal;
      }
      try {
        const parsed = new URL(cleanVal);
        const hostRegex = /^[a-z0-9.-]+\.[a-z]{2,10}$/i;
        if (!hostRegex.test(parsed.hostname)) {
          throw new Error();
        }
        return cleanVal;
      } catch (err) {
        throw new Error(`Invalid URL format for ${field}`);
      }
    };

    if (req.body.mobileNumber) {
      const phoneRegex = /^\+?[0-9]{10,15}$/;
      if (!phoneRegex.test(req.body.mobileNumber.replace(/\s+/g, ''))) {
        return res.status(400).json({ message: 'Invalid mobile number format' });
      }
    }

    if (req.body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(req.body.email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      const existingEmail = await User.findOne({ email: req.body.email.toLowerCase() });
      if (existingEmail && existingEmail._id.toString() !== req.user._id.toString()) {
        return res.status(400).json({ message: 'Email address already in use.' });
      }
      updates.email = req.body.email.toLowerCase();
    }

    if (req.body.dateOfBirth) {
      const dob = new Date(req.body.dateOfBirth);
      if (isNaN(dob.getTime())) {
        return res.status(400).json({ message: 'Invalid Date of Birth format' });
      }
      updates.dateOfBirth = dob;
    }

    // Validate required fields based on Account Type
    const currentAccountType = req.body.accountType || req.user.accountType;
    if (currentAccountType === 'student') {
      if (req.body.educationLevel === '') {
        return res.status(400).json({ message: 'Education Level is required for students.' });
      }
      if (req.body.collegeName === '') {
        return res.status(400).json({ message: 'College / School Name is required for students.' });
      }
      if (req.body.branch === '') {
        return res.status(400).json({ message: 'Branch / Stream is required for students.' });
      }
    } else if (currentAccountType === 'teacher') {
      if (req.body.institution === '') {
        return res.status(400).json({ message: 'School / College Name is required for teachers.' });
      }
      if (req.body.department === '') {
        return res.status(400).json({ message: 'Department is required for teachers.' });
      }
      if (req.body.subjectsTeaching === '') {
        return res.status(400).json({ message: 'Subjects Teaching is required for teachers.' });
      }
      if (req.body.qualification === '') {
        return res.status(400).json({ message: 'Qualification is required for teachers.' });
      }
      if (req.body.experienceYears === undefined || req.body.experienceYears === '') {
        return res.status(400).json({ message: 'Experience (Years) is required for teachers.' });
      }
    } else if (currentAccountType === 'professor') {
      if (req.body.institution === '') {
        return res.status(400).json({ message: 'University is required for professors.' });
      }
      if (req.body.department === '') {
        return res.status(400).json({ message: 'Department is required for professors.' });
      }
      if (req.body.researchArea === '') {
        return res.status(400).json({ message: 'Research Area is required for professors.' });
      }
      if (req.body.subjectsTeaching === '') {
        return res.status(400).json({ message: 'Subjects Teaching is required for professors.' });
      }
      if (req.body.qualification === '') {
        return res.status(400).json({ message: 'Qualification is required for professors.' });
      }
      if (req.body.experienceYears === undefined || req.body.experienceYears === '') {
        return res.status(400).json({ message: 'Experience (Years) is required for professors.' });
      }
    } else if (currentAccountType === 'job_seeker') {
      if (req.body.jobStatus === '') {
        return res.status(400).json({ message: 'Current Status is required for job seekers.' });
      }
      if (req.body.highestQualification === '') {
        return res.status(400).json({ message: 'Highest Qualification is required for job seekers.' });
      }
      if (req.body.preferredJobRole === '') {
        return res.status(400).json({ message: 'Preferred Job Role is required for job seekers.' });
      }
      if (req.body.preferredLocation === '') {
        return res.status(400).json({ message: 'Preferred Location is required for job seekers.' });
      }
    } else if (currentAccountType === 'professional') {
      if (req.body.companyName === '') {
        return res.status(400).json({ message: 'Company Name is required for professionals.' });
      }
      if (req.body.jobTitle === '') {
        return res.status(400).json({ message: 'Job Title is required for professionals.' });
      }
      if (req.body.industry === '') {
        return res.status(400).json({ message: 'Industry is required for professionals.' });
      }
      if (req.body.experienceYears === undefined || req.body.experienceYears === '') {
        return res.status(400).json({ message: 'Experience (Years) is required for professionals.' });
      }
    }

    let urlErr = null;
    allowed.forEach((k) => { 
      if (req.body[k] !== undefined) {
        if (k === 'year' || k === 'semester') {
          updates[k] = req.body[k] === '' ? null : Number(req.body[k]);
        } else if (k === 'showGender') {
          updates[k] = req.body[k] === 'true' || req.body[k] === true;
        } else if ([
          'githubUrl', 'linkedinUrl', 'portfolioUrl', 'websiteUrl', 
          'instagramUrl', 'xUrl', 'youtubeUrl', 'telegramUrl'
        ].includes(k)) {
          try {
            updates[k] = parseAndValidateUrl(k, req.body[k]);
          } catch (err) {
            urlErr = err.message;
          }
        } else {
          updates[k] = req.body[k]; 
        }
      }
    });

    if (urlErr) {
      return res.status(400).json({ message: urlErr });
    }

    if (req.body.skills !== undefined) {
      updates.skills = Array.isArray(req.body.skills) 
        ? req.body.skills 
        : typeof req.body.skills === 'string'
          ? req.body.skills.split(',').map(s => s.trim()).filter(Boolean)
          : [];
    }
    if (req.body.interests !== undefined) {
      updates.interests = Array.isArray(req.body.interests) 
        ? req.body.interests 
        : typeof req.body.interests === 'string'
          ? req.body.interests.split(',').map(s => s.trim()).filter(Boolean)
          : [];
    }

    if (req.body.visibilitySettings) {
      const settings = typeof req.body.visibilitySettings === 'string' 
        ? JSON.parse(req.body.visibilitySettings) 
        : req.body.visibilitySettings;
      updates.visibilitySettings = {
        ...req.user.visibilitySettings,
        ...settings
      };
    }
    if (req.body.openToOpportunities) {
      const opps = typeof req.body.openToOpportunities === 'string'
        ? JSON.parse(req.body.openToOpportunities)
        : req.body.openToOpportunities;
      updates.openToOpportunities = {
        internships: opps.internships === 'true' || opps.internships === true,
        teamMembers: opps.teamMembers === 'true' || opps.teamMembers === true,
        hackathons: opps.hackathons === 'true' || opps.hackathons === true,
        freelance: opps.freelance === 'true' || opps.freelance === true,
        mentoring: opps.mentoring === 'true' || opps.mentoring === true,
        projectCollaborators: opps.projectCollaborators === 'true' || opps.projectCollaborators === true,
        studyPartners: opps.studyPartners === 'true' || opps.studyPartners === true,
        placementGroups: opps.placementGroups === 'true' || opps.placementGroups === true,
        custom: Array.isArray(opps.custom) 
          ? opps.custom.map(c => c.trim()).filter(Boolean) 
          : typeof opps.custom === 'string'
            ? opps.custom.split(',').map(c => c.trim()).filter(Boolean)
            : []
      };
    }
    if (req.body.username !== undefined) {
      const cleanUser = req.body.username.trim().toLowerCase();
      const usernameRegex = /^[a-zA-Z0-9_]{4,30}$/;
      if (!usernameRegex.test(cleanUser)) {
        return res.status(400).json({ message: 'Username must be between 4 and 30 characters and contain only letters, numbers, and underscores.' });
      }
      
      const existing = await User.findOne({ username: cleanUser });
      if (existing && existing._id.toString() !== req.user._id.toString()) {
        return res.status(400).json({ message: 'Username already taken.' });
      }
      updates.username = cleanUser;
    }

    // Handle file uploads and delete old files from R2 on replacement
    const deleteFromR2 = require('../utils/deleteFromR2');

    if (req.files) {
      if (req.files.avatar && req.files.avatar[0]) {
        if (req.user.avatar) {
          await deleteFromR2(req.user.avatar);
        }
        updates.avatar = req.files.avatar[0].path;
      }
      if (req.files.coverPhoto && req.files.coverPhoto[0]) {
        if (req.user.coverPhoto) {
          await deleteFromR2(req.user.coverPhoto);
        }
        updates.coverPhoto = req.files.coverPhoto[0].path;
      }
      if (req.files.resume && req.files.resume[0]) {
        if (req.user.resumeUrl) {
          await deleteFromR2(req.user.resumeUrl);
        }
        updates.resumeUrl = req.files.resume[0].path;
      }
    }
    if (req.body.avatar === '' || req.body.avatar === null) {
      if (req.user.avatar) {
        await deleteFromR2(req.user.avatar);
      }
      updates.avatar = '';
    }
    if (req.body.coverPhoto === '' || req.body.coverPhoto === null) {
      if (req.user.coverPhoto) {
        await deleteFromR2(req.user.coverPhoto);
      }
      updates.coverPhoto = '';
    }
    if (req.body.resumeUrl === '' || req.body.resumeUrl === null) {
      if (req.user.resumeUrl) {
        await deleteFromR2(req.user.resumeUrl);
      }
      updates.resumeUrl = '';
    }

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(req.body.password, salt);
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    
    const io = req.app.get('io');
    if (io) {
      io.emit('profile_updated', { userId: req.user._id, user: sanitizeUser(user) });
    }

    res.json(sanitizeUser(user));
  } catch (err) {
    console.error('[updateUserProfile]', err);
    res.status(500).json({ message: err.message || 'Server error.' });
  }
};

// ── @route  GET /api/auth/dashboard ──────────────────────────────────────
const getDashboardData = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Helper: Determine weekday based on timezone
    const getWeekdayInTimezone = (timezoneStr) => {
      try {
        const options = { weekday: 'short', timeZone: timezoneStr || undefined };
        return new Intl.DateTimeFormat('en-US', options).format(new Date());
      } catch (e) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const d = new Date().getDay();
        return dayNames[d];
      }
    };

    const todayDay = getWeekdayInTimezone(user.timezone);

    // 1. Classes Today - use PersonalTimetable (student's own timetable)
    const PersonalTimetable = require('../models/PersonalTimetable');
    const tt = await PersonalTimetable.findOne({ user: user._id });
    const todayDayShort = todayDay.substring(0, 3); // "Friday" -> "Fri"
    const classesToday = tt ? tt.slots.filter(s => s.day === todayDayShort || s.day === todayDay).length : 0;

    // 2. Tasks stats
    const tasksPending = await Task.countDocuments({ user: user._id, status: { $ne: 'completed' } });
    const tasksCompleted = await Task.countDocuments({ user: user._id, status: 'completed' });

    // 3. Focus minutes today
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const sessionsToday = await FocusSession.find({
      user: user._id,
      createdAt: { $gte: start, $lte: end }
    });
    const focusMinutesToday = sessionsToday.reduce((a, s) => a + (s.actualMin || 0), 0);

    // 4. Exams Near
    const examsNear = await Task.countDocuments({
      user: user._id,
      $or: [
        { category: { $regex: /exam|test|quiz|assignment/i } },
        { title: { $regex: /exam|test|quiz|assignment/i } }
      ],
      status: { $ne: 'completed' },
      dueDate: { $gte: new Date() }
    });

    // 5. Attendance overall percentage
    const subjects = await Subject.find({ user: user._id, isArchived: false });
    const totalAttended = subjects.reduce((sum, s) => sum + s.attended, 0);
    const totalClassesCount = subjects.reduce((sum, s) => sum + s.totalClasses, 0);
    const attendancePercent = totalClassesCount > 0 ? Math.round((totalAttended / totalClassesCount) * 100) : 0;

    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? 'Good Morning' :
      hour < 17 ? 'Good Afternoon' :
                  'Good Evening';

    res.json({
      greeting,
      user: sanitizeUser(user),
      stats: {
        attendancePercent,
        tasksPending,
        tasksCompleted,
        classesToday,
        examsNear,
        focusMinutesToday,
        studyStreak: user.studyStreak || 0,
        totalFocusMinutes: user.totalFocusMinutes || 0,
      },
    });
  } catch (err) {
    console.error('[getDashboardData] error:', err.message);
    res.status(500).json({ message: 'Server error fetching dashboard data.' });
  }
};

// ── forgotPassword — POST /api/auth/forgot-password ──────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email or Username is required.' });

    const identifier = email.toLowerCase().trim();
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier }
      ]
    });
    if (!user) return res.status(404).json({ message: 'No account found with this identifier.' });

    if (user.isGoogleLinked) {
      return res.json({
        isGoogleLinked: true,
        message: 'This account is linked with Google. You can login directly.',
        email: user.email
      });
    } else {
      return res.status(400).json({
        isGoogleLinked: false,
        message: 'This account is not linked with Google. Please login using your password.'
      });
    }
  } catch (err) {
    console.error('[forgotPassword]', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ── verifyOtpAndReset — POST /api/auth/reset-password ────────────────────
const verifyOtpAndReset = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: 'Email, OTP, and new password are required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'Account not found.' });

    if (!user.resetOtp)
      return res.status(400).json({ message: 'Invalid OTP. Please request a new one.' });

    // Verify OTP using bcrypt (since it's hashed)
    const isMatch = await bcrypt.compare(otp, user.resetOtp);
    if (!isMatch)
      return res.status(400).json({ message: 'Invalid OTP. Please check and try again.' });

    if (!user.resetOtpExpiry || user.resetOtpExpiry < new Date())
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });

    // Update password using updateOne to avoid schema issues
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await User.updateOne(
      { _id: user._id },
      { $set: { 
          password: hashedPassword, 
          resetOtp: null, 
          resetOtpExpiry: null,
          otpRequestCount: 0,
          otpRequestLockUntil: null
        } 
      }
    );

    res.json({ message: 'Password reset successfully! You can now login.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ── @route  POST /api/auth/refresh ───────────────────────────────────────
const refreshToken = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) return res.status(401).json({ message: 'Refresh token required.' });
    if (typeof token !== 'string') return res.status(400).json({ message: 'Invalid token format.' });

    // Verify using JWT_REFRESH_SECRET (refresh tokens are signed with this key)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    } catch (verifyErr) {
      return res.status(403).json({ message: 'Refresh token expired or invalid.' });
    }
    
    // Find user and check if token exists in their refreshTokens array
    const user = await User.findById(decoded.id);
    if (!user || !user.refreshTokens.includes(token)) {
      return res.status(403).json({ message: 'Refresh token has been revoked.' });
    }

    // Generate new access token (short-lived)
    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    
    // Optionally rotate refresh token for enhanced security
    const newRefreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '90d' });
    user.refreshTokens = user.refreshTokens.filter(t => t !== token);
    user.refreshTokens = [...user.refreshTokens, newRefreshToken].slice(-5);
    await user.save();

    res.json({ token: accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('[refresh]', err.message);
    res.status(403).json({ message: 'Refresh token expired or invalid.' });
  }
};

// ── @route  POST /api/auth/logout ────────────────────────────────────────
const logoutUser = async (req, res) => {
  try {
    const { token } = req.body; // Refresh token
    
    if (token) {
      // Remove specific refresh token from array
      await User.updateOne(
        { refreshTokens: token },
        { $pull: { refreshTokens: token } }
      );
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[logout]', err.message);
    res.status(500).json({ message: 'Server error during logout.' });
  }
};

// ── @route  POST /api/auth/fcm-token ───────────────────────────────────────
const saveFcmToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required.' });

    // Push only if not already in array
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { fcmTokens: token } }
    );

    res.json({ message: 'FCM Token saved successfully.' });
  } catch (err) {
    console.error('[saveFcmToken]', err.message);
    res.status(500).json({ message: 'Server error saving FCM token.' });
  }
};

// ── @route  GET /api/auth/check-username ────────────────────────────────
const checkUsernameAvailability = async (req, res) => {
  try {
    const username = (req.query.username || '').trim().toLowerCase();
    if (!username) {
      return res.status(400).json({ message: 'Username parameter is required.' });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{4,30}$/;
    if (!usernameRegex.test(username)) {
      return res.json({ 
        available: false, 
        message: 'Username must be 4-30 characters, alphanumeric & underscores only.',
        suggestions: []
      });
    }

    const exists = await User.findOne({ username });
    if (exists) {
      // Generate suggestions
      const suggestions = [
        `${username}_01`,
        `${username}_ece`,
        `${username}2027`
      ];
      // Ensure suggestions don't already exist in database (filter them)
      const validSuggestions = [];
      for (const sug of suggestions) {
        const taken = await User.findOne({ username: sug });
        if (!taken) {
          validSuggestions.push(sug);
        }
      }
      if (validSuggestions.length === 0) {
        validSuggestions.push(`${username}_` + Math.floor(10 + Math.random() * 90));
        validSuggestions.push(`${username}_student`);
        validSuggestions.push(`${username}99`);
      }
      return res.json({ available: false, suggestions: validSuggestions });
    }

    res.json({ available: true });
  } catch (err) {
    console.error('[checkUsername]', err.message);
    res.status(500).json({ message: 'Server error checking username.' });
  }
};


// ── googleLogin — POST /api/auth/google-login ───────────────────────────
const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Google credential token is required.' });
    }

    // Verify token info via Google API
    let tokenInfo;
    try {
      const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      tokenInfo = response.data;
    } catch (err) {
      return res.status(400).json({ message: 'Invalid or expired Google token.' });
    }

    const { sub, email, name, picture, aud } = tokenInfo;

    // Verify aud matches our Client ID
    const allowedClientIds = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      '1032228296518-72v9ta3tvdropgr45h3ptgkktos1o4r4.apps.googleusercontent.com',
      '1032228296518-51mc80f6g6dsbd1drhmrkt98218a8t36.apps.googleusercontent.com'
    ].filter(Boolean);
    if (!allowedClientIds.includes(aud)) {
      return res.status(400).json({ message: 'Token audience mismatch (Unauthorized Google Client).' });
    }

    if (!email) {
      return res.status(400).json({ message: 'Google account does not provide email.' });
    }

    // 1. Search by googleId
    let user = await User.findOne({ googleId: sub });
    
    if (user) {
      // Login directly
      user.lastActiveAt = new Date();
      const tokens = generateTokens(user._id);
      user.refreshTokens = [...(user.refreshTokens || []), tokens.refreshToken].slice(-5);
      await user.save();

      return res.json({
        ...sanitizeUser(user),
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });
    }

    // 2. Search by Email to link
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.googleId = sub;
      user.isGoogleLinked = true;
      user.lastActiveAt = new Date();
      if (picture && !user.avatar) {
        user.avatar = picture;
      }
      const tokens = generateTokens(user._id);
      user.refreshTokens = [...(user.refreshTokens || []), tokens.refreshToken].slice(-5);
      await user.save();

      return res.json({
        ...sanitizeUser(user),
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });
    }

    // 3. Create a new account
    let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    if (baseUsername.length < 4) baseUsername = 'user_' + baseUsername;
    
    let username = baseUsername.toLowerCase();
    let isUsernameTaken = await User.findOne({ username });
    let counter = 1;
    while (isUsernameTaken) {
      username = `${baseUsername}${counter}`.toLowerCase();
      isUsernameTaken = await User.findOne({ username });
      counter++;
    }

    const salt = await bcrypt.genSalt(10);
    const randomPassword = Math.random().toString(36).substring(2, 12);
    const hashedPassword = await bcrypt.hash(randomPassword, salt);

    user = await User.create({
      fullName: name || 'Google User',
      email: email.toLowerCase(),
      password: hashedPassword,
      username: username,
      avatar: picture || '',
      isGoogleLinked: true,
      googleId: sub,
      accountType: 'student'
    });

    const tokens = generateTokens(user._id);
    user.refreshTokens = [tokens.refreshToken];
    await user.save();

    res.status(201).json({
      ...sanitizeUser(user),
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (err) {
    console.error('[googleLogin]', err.message);
    res.status(500).json({ message: 'Server error processing Google Sign-in.' });
  }
};

// ── connectGoogle — POST /api/auth/connect-google ───────────────────────
const connectGoogle = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Google token is required.' });
    }

    let tokenInfo;
    try {
      const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      tokenInfo = response.data;
    } catch (err) {
      return res.status(400).json({ message: 'Invalid or expired Google token.' });
    }

    const { sub, aud } = tokenInfo;
    const allowedClientIds = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      '1032228296518-72v9ta3tvdropgr45h3ptgkktos1o4r4.apps.googleusercontent.com',
      '1032228296518-51mc80f6g6dsbd1drhmrkt98218a8t36.apps.googleusercontent.com'
    ].filter(Boolean);
    if (!allowedClientIds.includes(aud)) {
      return res.status(400).json({ message: 'Token audience mismatch.' });
    }

    // Check if sub is already linked to another user
    const existing = await User.findOne({ googleId: sub });
    if (existing && existing._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({ message: 'This Google account is already linked to another Student OS profile.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.googleId = sub;
    user.isGoogleLinked = true;
    await user.save();

    res.json({
      success: true,
      message: 'Google account linked successfully.',
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('[connectGoogle]', err.message);
    res.status(500).json({ message: 'Server error linking Google account.' });
  }
};

// ── getConnectedAccounts — GET /api/auth/connected-accounts ──────────────
const getConnectedAccounts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({
      googleConnected: user.isGoogleLinked || false,
      googleEmail: user.isGoogleLinked ? user.email : null
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching connected accounts.' });
  }
};

// ── linkRollNumber — POST /api/auth/colleges/link ───────────────────────
const linkRollNumber = async (req, res) => {
  try {
    const { collegeCode, rollNumber, password } = req.body;
    if (!collegeCode || !rollNumber || !password) {
      return res.status(400).json({ message: 'College Code, Roll Number and Password are required.' });
    }

    const { logAction } = require('../services/auditLogService');

    // Find official academic student master record
    const record = await StudentRecord.findOne({
      collegeCode: collegeCode.toUpperCase(),
      rollNumber: rollNumber.toUpperCase()
    });

    if (!record) {
      return res.status(404).json({ message: 'No official academic record found for this roll number.' });
    }

    // Find pre-created college User account
    const collegeUser = await User.findOne({
      collegeCode: collegeCode.toUpperCase(),
      username: rollNumber.toLowerCase(),
      accountType: 'college'
    });

    if (!collegeUser) {
      return res.status(404).json({ message: 'College account not pre-created or already merged.' });
    }

    // Verify password of the college account
    const isMatch = await bcrypt.compare(password, collegeUser.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password for this college account.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Link student profile
    user.fullName = record.fullName;
    user.collegeCode = collegeCode.toUpperCase();
    user.rollNumber = record.rollNumber;
    user.studentId = record.studentId;
    user.branch = record.branch;
    user.year = parseInt(record.academicYear.split('-')[0]) || undefined;
    user.semester = record.semester;
    user.section = record.section;
    user.isCollegeConnected = true;
    user.collegeLinked = true;
    user.accountType = 'college'; // Upgraded to college account

    await user.save();

    // Link the Student Record to this User
    record.linkedUserId = user._id;
    await record.save();

    // Delete the duplicate pre-created college User account to free up the username/rollNumber index
    await User.deleteOne({ _id: collegeUser._id });

    // Propagate changes via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(collegeCode.toUpperCase()).emit('student_linked', { userId: user._id, rollNumber: record.rollNumber, record });
    }

    // Audit logs
    await logAction(user._id, 'student', collegeCode.toUpperCase(), record.branch, `STUDENT_LINKED: ${record.rollNumber}`, req);

    res.status(200).json({
      message: 'Student OS profile linked successfully.',
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('linkRollNumber error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const collegeLogin = async (req, res) => {
  try {
    const { collegeCode, rollNumber, password } = req.body;
    if (!collegeCode || !rollNumber || !password) {
      return res.status(400).json({ message: 'College Code, Roll Number and Password are required.' });
    }

    const collegeUpper = collegeCode.toUpperCase().trim();
    const rollUpper = rollNumber.toUpperCase().trim();
    const rollLower = rollNumber.toLowerCase().trim();

    // 1. Verify College exists
    const college = await College.findOne({ collegeCode: collegeUpper });
    if (!college) {
      return res.status(404).json({ message: `College '${collegeCode}' not registered on Student OS.` });
    }

    // 2. Find User
    let user = await User.findOne({
      collegeCode: collegeUpper,
      username: rollLower
    });

    if (!user) {
      const StudentRecord = require('../models/StudentRecord');
      const record = await StudentRecord.findOne({
        collegeCode: collegeUpper,
        rollNumber: rollUpper
      });
      if (record) {
        const { autoProvisionUserForStudent } = require('../services/autoProvisionStudent');
        user = await autoProvisionUserForStudent(record);
      }
    }

    if (!user) {
      return res.status(404).json({ message: `No official student record found for Roll Number '${rollNumber}' in College '${collegeCode}'.` });
    }

    // 3. Verify Password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: `Incorrect password for Student Roll Number '${rollNumber}'.` });
    }

    const tokens = generateTokens(user._id);
    const updatedRefreshTokens = [...(user.refreshTokens || []), tokens.refreshToken].slice(-5);
    user.refreshTokens = updatedRefreshTokens;
    user.lastActiveAt = new Date();
    await user.save();

    res.json({
      ...sanitizeUser(user),
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      firstLogin: user.firstLogin
    });
  } catch (err) {
    console.error('collegeLogin error:', err.message);
    res.status(500).json({ message: 'Server error during College Login.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid current password.' });
    }

    // Verify new password is not identical to current
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password cannot be the same as current password.' });
    }

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

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.firstLogin = false;
    user.passwordLastChanged = new Date();
    await user.save();

    res.json({ message: 'Password updated successfully!', user: sanitizeUser(user) });
  } catch (err) {
    console.error('changePassword error:', err.message);
    res.status(500).json({ message: 'Server error updating password.' });
  }
};

const collegeForgotPassword = async (req, res) => {
  try {
    const { collegeCode, rollNumber } = req.body;
    if (!collegeCode || !rollNumber) {
      return res.status(400).json({ message: 'College Code and Roll Number are required.' });
    }

    const record = await StudentRecord.findOne({
      collegeCode: collegeCode.toUpperCase().trim(),
      rollNumber: rollNumber.toUpperCase().trim()
    });

    if (!record) {
      return res.status(404).json({ message: 'No student record found for this roll number.' });
    }

    // Get email & mobile from record
    const rawEmail = record.parentDetails?.parentEmail || '';
    const rawMobile = record.mobileNumber || '';

    // Mask them helper
    const maskEmail = (emailStr) => {
      if (!emailStr) return '';
      const parts = emailStr.split('@');
      if (parts.length < 2) return emailStr;
      const name = parts[0];
      const domain = parts[1];
      const maskedName = name.length > 2 ? name.substring(0, 2) + '*'.repeat(name.length - 2) : name + '**';
      return maskedName + '@' + domain;
    };

    const maskMobile = (mobStr) => {
      if (!mobStr) return '';
      return mobStr.length > 4 ? mobStr.substring(0, 3) + '*'.repeat(mobStr.length - 6) + mobStr.substring(mobStr.length - 3) : '***';
    };

    res.json({
      success: true,
      maskedEmail: maskEmail(rawEmail) || 'Not Configured',
      maskedPhone: maskMobile(rawMobile) || 'Not Configured'
    });
  } catch (err) {
    console.error('collegeForgotPassword error:', err.message);
    res.status(500).json({ message: 'Server error processing forgot password.' });
  }
};

const collegeSendOtp = async (req, res) => {
  try {
    const { collegeCode, rollNumber, channel } = req.body;
    if (!collegeCode || !rollNumber || !channel) {
      return res.status(400).json({ message: 'College Code, Roll Number, and Send Channel are required.' });
    }

    let user = await User.findOne({
      collegeCode: collegeCode.toUpperCase().trim(),
      username: rollNumber.toLowerCase().trim()
    });

    if (!user) {
      const StudentRecord = require('../models/StudentRecord');
      const record = await StudentRecord.findOne({
        collegeCode: collegeCode.toUpperCase().trim(),
        rollNumber: rollNumber.toUpperCase().trim()
      });
      if (record) {
        const { autoProvisionUserForStudent } = require('../services/autoProvisionStudent');
        user = await autoProvisionUserForStudent(record);
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'No student account found for this Roll Number.' });
    }

    // Generate random 6-digit OTP string
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    
    // Hash it for DB storage
    const salt = await bcrypt.genSalt(10);
    user.resetOtp = await bcrypt.hash(otp, salt);
    user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    console.log(`🔑 [OTP Reset] Generated OTP for Roll: ${rollNumber}, OTP: ${otp}`);

    res.json({
      success: true,
      message: `OTP sent successfully to your registered ${channel}!`,
      debugOtp: otp // Included for seamless verification/debug testing
    });
  } catch (err) {
    console.error('collegeSendOtp error:', err.message);
    res.status(500).json({ message: 'Server error sending OTP.' });
  }
};

const collegeVerifyOtp = async (req, res) => {
  try {
    const { collegeCode, rollNumber, otp } = req.body;
    if (!collegeCode || !rollNumber || !otp) {
      return res.status(400).json({ message: 'College Code, Roll Number, and OTP are required.' });
    }

    const user = await User.findOne({
      collegeCode: collegeCode.toUpperCase().trim(),
      username: rollNumber.toLowerCase().trim()
    });

    if (!user || !user.resetOtp) {
      return res.status(400).json({ message: 'No active OTP verification session found.' });
    }

    if (user.resetOtpExpiry < new Date()) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    const isMatch = await bcrypt.compare(otp, user.resetOtp);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid OTP. Please check and try again.' });
    }

    res.json({ success: true, message: 'OTP verified successfully.' });
  } catch (err) {
    console.error('collegeVerifyOtp error:', err.message);
    res.status(500).json({ message: 'Server error verifying OTP.' });
  }
};

const collegeResetPassword = async (req, res) => {
  try {
    const { collegeCode, rollNumber, otp, newPassword } = req.body;
    if (!collegeCode || !rollNumber || !otp || !newPassword) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const user = await User.findOne({
      collegeCode: collegeCode.toUpperCase().trim(),
      username: rollNumber.toLowerCase().trim()
    });

    if (!user || !user.resetOtp) {
      return res.status(400).json({ message: 'No active OTP verification session found.' });
    }

    if (user.resetOtpExpiry < new Date()) {
      return res.status(400).json({ message: 'OTP has expired.' });
    }

    const isMatch = await bcrypt.compare(otp, user.resetOtp);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

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

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetOtp = null;
    user.resetOtpExpiry = null;
    user.firstLogin = false; // By resetting password, they bypass first login redirect
    user.status = 'ACTIVE';
    user.passwordLastChanged = new Date();
    await user.save();

    res.json({ message: 'Password reset successfully. You can now login.' });
  } catch (err) {
    console.error('collegeResetPassword error:', err.message);
    res.status(500).json({ message: 'Server error resetting password.' });
  }
};

// Onboarding demo lead submission
const submitLead = async (req, res) => {
  try {
    const Lead = require('../models/Lead');
    const { collegeName, contactPerson, mobileNumber, email, city, studentStrength, message } = req.body;
    if (!collegeName || !contactPerson || !mobileNumber || !email || !city) {
      return res.status(400).json({ message: 'Missing required onboarding lead parameters.' });
    }

    const lead = await Lead.create({
      collegeName,
      contactPerson,
      mobileNumber,
      email: email.toLowerCase(),
      city,
      studentStrength,
      message
    });

    res.status(201).json({ message: 'Demo request received successfully. Our team will contact you shortly.', lead });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getDashboardData,
  forgotPassword,
  verifyOtpAndReset,
  refreshToken,
  logoutUser,
  saveFcmToken,
  checkUsernameAvailability,
  googleLogin,
  connectGoogle,
  getConnectedAccounts,
  searchColleges,
  verifyRollNumber,
  linkRollNumber,
  collegeLogin,
  changePassword,
  collegeForgotPassword,
  collegeSendOtp,
  collegeVerifyOtp,
  collegeResetPassword,
  submitLead
};

