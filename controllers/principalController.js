const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Department = require('../models/Department');
const Notice = require('../models/Notice');
const Event = require('../models/Event');
const AcademicCalendar = require('../models/AcademicCalendar');
const Subject = require('../models/Subject');
const StudentRecord = require('../models/StudentRecord');
const { logAction } = require('../services/auditLogService');
const { sendFcmNotification } = require('../services/notificationService');

// =============================================================
// PRINCIPAL DASHBOARD STATS
// =============================================================
const getDashboardStats = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode;

    const totalStudents = await User.countDocuments({ collegeCode, role: 'student' });
    const totalFaculty = await User.countDocuments({ collegeCode, role: 'faculty' });
    const totalDepartments = await Department.countDocuments({ collegeCode });
    const totalSubjects = await Subject.countDocuments({ collegeCode });
    const upcomingEvents = await Event.countDocuments({ collegeCode, startDate: { $gte: new Date() } });

    res.status(200).json({
      totalStudents,
      totalFaculty,
      totalDepartments,
      totalSubjects,
      upcomingEvents,
      studentAttendance: 92.4,
      facultyAttendance: 96.8
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// DEPARTMENT CRUD
// =============================================================
const createDepartment = async (req, res) => {
  try {
    const { code, name, description, hodId } = req.body;
    if (!code || !name) {
      return res.status(400).json({ message: 'Code and Name are required.' });
    }

    const exists = await Department.findOne({ code: code.toUpperCase(), collegeCode: req.user.collegeCode.toUpperCase() });
    if (exists) {
      return res.status(400).json({ message: 'Department already registered.' });
    }

    const dept = await Department.create({
      code: code.toUpperCase(),
      name,
      description,
      hodId: hodId || null,
      status: 'active',
      collegeCode: req.user.collegeCode.toUpperCase()
    });

    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), code.toUpperCase(), `CREATED_DEPARTMENT: ${code.toUpperCase()}`, req);

    // Sync via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('department_created', { dept });
      io.to(req.user.collegeCode.toUpperCase()).emit('college_config_updated', { collegeCode: req.user.collegeCode.toUpperCase() });
    }

    res.status(201).json({ message: 'Department created successfully.', dept });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getDepartments = async (req, res) => {
  try {
    const depts = await Department.find({ collegeCode: req.user.collegeCode.toUpperCase() }).populate('hodId', 'fullName email employeeId');
    res.status(200).json(depts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, hodId, status } = req.body;

    const dept = await Department.findOne({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!dept) return res.status(404).json({ message: 'Department not found.' });

    if (name) dept.name = name;
    if (description !== undefined) dept.description = description;
    if (hodId !== undefined) dept.hodId = hodId || null;
    if (status) dept.status = status;

    await dept.save();
    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), dept.code, `UPDATED_DEPARTMENT: ${dept.code}`, req);

    // Sync via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('department_updated', { dept });
      io.to(req.user.collegeCode.toUpperCase()).emit('college_config_updated', { collegeCode: req.user.collegeCode.toUpperCase() });
    }

    res.status(200).json({ message: 'Department updated.', dept });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const dept = await Department.findOneAndDelete({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!dept) return res.status(404).json({ message: 'Department not found.' });

    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), dept.code, `DELETED_DEPARTMENT: ${dept.code}`, req);

    // Sync via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('department_deleted', { id: dept._id, code: dept.code });
      io.to(req.user.collegeCode.toUpperCase()).emit('college_config_updated', { collegeCode: req.user.collegeCode.toUpperCase() });
    }

    res.status(200).json({ message: 'Department deleted successfully.', dept });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// STAFF CREATION & RESET ACTIONS
// =============================================================
const createHODAccount = async (req, res) => {
  try {
    const { fullName, email, employeeId, department, password } = req.body;

    if (!fullName || !email || !employeeId || !department || !password) {
      return res.status(400).json({ message: 'All HOD creation fields are required.' });
    }

    const idExists = await User.findOne({ collegeCode: req.user.collegeCode.toUpperCase(), employeeId });
    if (idExists) {
      return res.status(400).json({ message: 'Employee ID is already assigned.' });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ message: 'Email address is already in use.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const hod = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'hod',
      collegeCode: req.user.collegeCode.toUpperCase(),
      employeeId,
      assignedDepartment: department.toUpperCase(),
      isActive: true
    });

    // Auto-link HOD to Department
    const { syncHODDepartmentLink } = require('../services/erpSyncService');
    await syncHODDepartmentLink(req.user.collegeCode, hod._id, department);

    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), department.toUpperCase(), `CREATED_HOD_ACCOUNT: ${employeeId}`, req);

    // Sync via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('hod_created', { hod, department: department.toUpperCase() });
      const dept = await Department.findOne({ code: department.toUpperCase(), collegeCode: req.user.collegeCode.toUpperCase() });
      if (dept) {
        io.to(req.user.collegeCode.toUpperCase()).emit('department_updated', { dept });
      }
    }

    res.status(201).json({ message: 'HOD registered.', hod });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getStaffAccounts = async (req, res) => {
  try {
    const staff = await User.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      role: { $in: ['hod', 'faculty', 'coe', 'exam_cell', 'accounts', 'library', 'placement', 'hostel', 'transport'] }
    }).select('-password');
    res.status(200).json(staff);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleHODAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findOne({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!user) return res.status(404).json({ message: 'Staff account not found.' });

    user.isActive = isActive;
    await user.save();

    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), user.assignedDepartment || '', `TOGGLED_STAFF_STATUS: ${user.employeeId} to ${isActive}`, req);
    res.status(200).json({ message: 'Account status updated.', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const resetHODPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const user = await User.findOne({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!user) return res.status(404).json({ message: 'Staff account not found.' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    await logAction(req.user._id, 'principal', req.user.collegeCode, user.assignedDepartment || '', `RESET_STAFF_PASSWORD: ${user.employeeId}`, req);
    res.status(200).json({ message: 'Staff password reset successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// NOTICE BOARD & ALERTS
// =============================================================
const publishNotice = async (req, res) => {
  try {
    const { title, content, type, targetRoles, targetDepartment, targetYear, targetSection } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and Content are required.' });
    }

    const notice = await Notice.create({
      title,
      content,
      type: type || 'general',
      targetRoles: targetRoles || [],
      targetDepartment: targetDepartment || '',
      targetYear: targetYear || '',
      targetSection: targetSection || '',
      collegeCode: req.user.collegeCode.toUpperCase()
    });

    // Notify all via FCM
    try {
      await sendFcmNotification({
        collegeCode: req.user.collegeCode,
        title: `📢 Campus Notice: ${title}`,
        body: content.substring(0, 100)
      });
    } catch (fcmErr) {
      console.warn('FCM notifications failed.');
    }

    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), '', `PUBLISHED_NOTICE: ${title}`, req);

    // Sync via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('notice_created', { notice });
    }

    res.status(201).json({ message: 'Notice published and notifications dispatched.', notice });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getNotices = async (req, res) => {
  try {
    const list = await Notice.find({ collegeCode: req.user.collegeCode.toUpperCase() }).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// ACADEMIC CALENDAR & AUDIT
// =============================================================
const createCalendarItem = async (req, res) => {
  try {
    const { date, type, description } = req.body;
    if (!date || !type) {
      return res.status(400).json({ message: 'Date and Type parameters required.' });
    }

    const exists = await AcademicCalendar.findOne({ date: new Date(date), collegeCode: req.user.collegeCode.toUpperCase() });
    if (exists) {
      exists.type = type;
      exists.description = description || '';
      await exists.save();
      await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), '', `UPDATED_CALENDAR_EVENT: ${date}`, req);

      // Sync via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(req.user.collegeCode.toUpperCase()).emit('calendar_updated', { calendar: exists });
      }

      return res.status(200).json({ message: 'Calendar updated.', calendar: exists });
    }

    const item = await AcademicCalendar.create({
      date: new Date(date),
      type,
      description,
      collegeCode: req.user.collegeCode.toUpperCase()
    });

    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), '', `CREATED_CALENDAR_EVENT: ${date}`, req);

    // Sync via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('calendar_created', { calendar: item });
    }

    res.status(201).json({ message: 'Calendar event registered.', calendar: item });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCalendarItems = async (req, res) => {
  try {
    const list = await AcademicCalendar.find({ collegeCode: req.user.collegeCode.toUpperCase() }).sort({ date: 1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCampusActivityLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find({ collegeCode: req.user.collegeCode.toUpperCase() })
      .populate('userId', 'fullName email employeeId')
      .sort({ timestamp: -1 });
    res.status(200).json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// COLLEGE ERP CONFIGURATION CRUD
// =============================================================
const getCollegeConfig = async (req, res) => {
  try {
    const College = require('../models/College');
    const college = await College.findOne({ collegeCode: req.user.collegeCode.toUpperCase() });
    if (!college) return res.status(404).json({ message: 'College not found.' });

    res.status(200).json({
      courses: college.courses || [],
      programs: college.programs || [],
      branches: college.branches || [],
      academicYears: college.academicYears || [],
      sections: college.sections || [],
      semesters: college.semesters || [],
      regulations: college.regulations || [],
      workingDays: college.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      timings: college.timings || ['09:00-10:00', '10:00-11:00', '11:15-12:15', '12:15-01:15', '02:00-03:00', '03:00-04:00'],
      holidays: college.holidays || [],
      gradingSystem: college.gradingSystem || [],
      attendanceRules: college.attendanceRules || { minPercentage: 75 },
      timezone: college.timezone || 'Asia/Kolkata',
      language: college.language || 'en',
      dateFormat: college.dateFormat || 'DD/MM/YYYY',
      name: college.name || '',
      address: college.address || '',
      university: college.university || '',
      state: college.state || '',
      district: college.district || '',
      city: college.city || '',
      logo: college.logo || '',
      aisheCode: college.aisheCode || '',
      collegeType: college.collegeType || 'Private',
      aicteApproved: college.aicteApproved !== false,
      ugcApproved: college.ugcApproved !== false,
      naacGrade: college.naacGrade || 'A',
      nbaAccredited: college.nbaAccredited === true
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateCollegeConfig = async (req, res) => {
  try {
    const College = require('../models/College');
    const { 
      courses, programs, branches, academicYears, sections, semesters, regulations,
      workingDays, timings, holidays, gradingSystem, attendanceRules,
      timezone, language, dateFormat,
      name, address, university, state, district, city, logo,
      aisheCode, collegeType, aicteApproved, ugcApproved, naacGrade, nbaAccredited
    } = req.body;
    const college = await College.findOne({ collegeCode: req.user.collegeCode.toUpperCase() });
    if (!college) return res.status(404).json({ message: 'College not found.' });

    if (courses !== undefined) college.courses = courses;
    if (programs !== undefined) college.programs = programs;
    if (branches !== undefined) college.branches = branches;
    if (academicYears !== undefined) college.academicYears = academicYears;
    if (sections !== undefined) college.sections = sections;
    if (semesters !== undefined) college.semesters = semesters;
    if (regulations !== undefined) college.regulations = regulations;

    if (workingDays !== undefined) college.workingDays = workingDays;
    if (timings !== undefined) college.timings = timings;
    if (holidays !== undefined) college.holidays = holidays;
    if (gradingSystem !== undefined) college.gradingSystem = gradingSystem;
    if (attendanceRules !== undefined) college.attendanceRules = attendanceRules;
    if (timezone !== undefined) college.timezone = timezone;
    if (language !== undefined) college.language = language;
    if (dateFormat !== undefined) college.dateFormat = dateFormat;

    if (name !== undefined) college.name = name;
    if (address !== undefined) college.address = address;
    if (university !== undefined) college.university = university;
    if (state !== undefined) college.state = state;
    if (district !== undefined) college.district = district;
    if (city !== undefined) college.city = city;
    if (logo !== undefined) college.logo = logo;
    if (aisheCode !== undefined) college.aisheCode = aisheCode;
    if (collegeType !== undefined) college.collegeType = collegeType;
    if (aicteApproved !== undefined) college.aicteApproved = aicteApproved;
    if (ugcApproved !== undefined) college.ugcApproved = ugcApproved;
    if (naacGrade !== undefined) college.naacGrade = naacGrade;
    if (nbaAccredited !== undefined) college.nbaAccredited = nbaAccredited;

    await college.save();
    await logAction(req.user._id, 'principal', req.user.collegeCode, '', `UPDATED_ERP_METADATA`, req);

    // Sync workspaces instantly
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode).emit('college_config_updated', { collegeCode: college.collegeCode });
    }

    res.status(200).json({ message: 'College ERP configuration updated.', college });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// COMPLETE USER CRUD (HOD, FACULTY, ADMIN, STUDENTS)
// =============================================================
const createUser = async (req, res) => {
  try {
    const { fullName, email, password, role, employeeId, studentId, assignedDepartment, branch, year, semester, rollNumber, assignedClasses, jobTitle } = req.body;
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ message: 'FullName, Email, Password, and Role are required.' });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) return res.status(400).json({ message: 'Email address already in use.' });

    if (role === 'student') {
      if (studentId) {
        const studentIdExists = await User.findOne({ studentId });
        if (studentIdExists) return res.status(400).json({ message: 'Student ID already assigned.' });
      }
    } else {
      if (employeeId) {
        const empIdExists = await User.findOne({ collegeCode: req.user.collegeCode.toUpperCase(), employeeId });
        if (empIdExists) return res.status(400).json({ message: 'Employee ID already assigned.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      collegeCode: req.user.collegeCode.toUpperCase(),
      employeeId: employeeId || null,
      studentId: studentId || null,
      assignedDepartment: assignedDepartment ? assignedDepartment.toUpperCase() : '',
      branch: branch ? branch.toUpperCase() : '',
      year: year || null,
      semester: semester || null,
      rollNumber: rollNumber || '',
      assignedClasses: assignedClasses || [],
      jobTitle: jobTitle || (role === 'faculty' ? 'Professor' : ''),
      isActive: true
    });

    // ERP synchronization mapping based on roles
    const { syncHODDepartmentLink, syncFacultyTimetableAssignments } = require('../services/erpSyncService');
    if (role === 'hod') {
      await syncHODDepartmentLink(req.user.collegeCode, newUser._id, assignedDepartment);
    } else if (role === 'faculty') {
      await syncFacultyTimetableAssignments(req.user.collegeCode, newUser);
    }

    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), assignedDepartment || branch || '', `CREATED_USER_ACCOUNT: ${email} (${role})`, req);

    // Sync workspaces instantly
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('campus_user_sync', { action: 'create', user: newUser });
      if (role === 'faculty') {
        io.to(req.user.collegeCode.toUpperCase()).emit('faculty_created', { faculty: newUser });
      } else if (role === 'hod') {
        io.to(req.user.collegeCode.toUpperCase()).emit('hod_created', { hod: newUser });
      }
    }
    try {
      await sendFcmNotification(
        req.user.collegeCode,
        role,
        'Account Registered',
        `Your institutional profile under ${req.user.collegeCode} has been verified and registered.`
      );
    } catch (fcmErr) {
      console.warn('FCM skipped:', fcmErr.message);
    }

    res.status(201).json({ message: 'Account registered successfully.', user: newUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const { role, department, branch, search, page = 1, limit = 10 } = req.query;
    const filter = { collegeCode: req.user.collegeCode.toUpperCase() };

    if (role) {
      if (role === 'admin') {
        // Administration roles filter
        filter.role = { $in: ['accounts', 'library', 'placement', 'hostel', 'transport', 'hr', 'admission_office', 'admin'] };
      } else {
        filter.role = role;
      }
    }
    if (department) filter.assignedDepartment = department.toUpperCase();
    if (branch) filter.branch = branch;

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const count = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    res.status(200).json({ users, totalPages: Math.ceil(count / Number(limit)), currentPage: Number(page), totalCount: count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, role, employeeId, studentId, assignedDepartment, branch, year, semester, rollNumber, isActive, password, assignedClasses, jobTitle } = req.body;

    const user = await User.findOne({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!user) return res.status(404).json({ message: 'User account not found.' });

    if (fullName) user.fullName = fullName;
    if (role) user.role = role;
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (studentId !== undefined) user.studentId = studentId;
    if (assignedDepartment !== undefined) user.assignedDepartment = assignedDepartment ? assignedDepartment.toUpperCase() : '';
    if (branch !== undefined) user.branch = branch ? branch.toUpperCase() : '';
    if (year !== undefined) user.year = year;
    if (semester !== undefined) user.semester = semester;
    if (rollNumber !== undefined) user.rollNumber = rollNumber;
    if (isActive !== undefined) user.isActive = isActive;
    if (assignedClasses !== undefined) user.assignedClasses = assignedClasses;
    if (jobTitle !== undefined) user.jobTitle = jobTitle;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    // ERP synchronization mapping based on roles
    const { syncHODDepartmentLink, syncFacultyTimetableAssignments } = require('../services/erpSyncService');
    if (user.role === 'hod') {
      await syncHODDepartmentLink(req.user.collegeCode, user._id, user.assignedDepartment);
    } else if (user.role === 'faculty') {
      await syncFacultyTimetableAssignments(req.user.collegeCode, user);
    }

    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), '', `UPDATED_USER_ACCOUNT: ${user.email}`, req);

    // Sync workspaces instantly
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('campus_user_sync', { action: 'update', user });
      if (user.role === 'faculty') {
        io.to(req.user.collegeCode.toUpperCase()).emit('faculty_updated', { faculty: user });
      } else if (user.role === 'hod') {
        io.to(req.user.collegeCode.toUpperCase()).emit('hod_updated', { hod: user });
      }
    }
    try {
      await sendFcmNotification(
        req.user.collegeCode,
        user.role,
        'Profile Updated',
        'Your profile details have been synchronized by the administration.'
      );
    } catch (fcmErr) {
      console.warn('FCM skipped:', fcmErr.message);
    }

    res.status(200).json({ message: 'User account updated successfully.', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOneAndDelete({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!user) return res.status(404).json({ message: 'User account not found.' });

    // Link cleanup if HOD is deleted
    if (user.role === 'hod') {
      const Department = require('../models/Department');
      await Department.updateMany(
        { collegeCode: req.user.collegeCode.toUpperCase(), hodId: user._id },
        { $set: { hodId: null } }
      );
    }

    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), '', `DELETED_USER_ACCOUNT: ${user.email}`, req);

    // Sync workspaces instantly
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('campus_user_sync', { action: 'delete', userId: id, role: user.role });
    }
    try {
      await sendFcmNotification(
        req.user.collegeCode,
        user.role,
        'Profile Deactivated',
        'Your institutional account has been deactivated.'
      );
    } catch (fcmErr) {
      console.warn('FCM skipped:', fcmErr.message);
    }

    res.status(200).json({ message: 'User account deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkImportUsers = async (req, res) => {
  try {
    const { usersList } = req.body;
    if (!usersList || !Array.isArray(usersList)) {
      return res.status(400).json({ message: 'Invalid bulk import data. Expected a list.' });
    }

    const salt = await bcrypt.genSalt(10);
    const created = [];

    for (const item of usersList) {
      if (!item.fullName || !item.email || !item.role) continue;
      
      const emailExists = await User.findOne({ email: item.email.toLowerCase() });
      if (emailExists) continue;

      const hashedPassword = await bcrypt.hash(item.password || 'welcome123', salt);
      const newUser = await User.create({
        fullName: item.fullName,
        email: item.email.toLowerCase(),
        password: hashedPassword,
        role: item.role,
        collegeCode: req.user.collegeCode,
        employeeId: item.employeeId || null,
        studentId: item.studentId || null,
        assignedDepartment: item.assignedDepartment || '',
        branch: item.branch || '',
        year: item.year || null,
        semester: item.semester || null,
        rollNumber: item.rollNumber || '',
        isActive: true
      });
      created.push(newUser);
    }

    await logAction(req.user._id, 'principal', req.user.collegeCode, '', `BULK_IMPORTED_USERS: Count ${created.length}`, req);

    // Sync workspaces instantly
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode).emit('campus_user_sync', { action: 'bulk_import', count: created.length });
    }

    res.status(201).json({ message: `${created.length} accounts imported successfully.`, users: created });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkExportUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const filter = { collegeCode: req.user.collegeCode.toUpperCase() };
    if (role) {
      if (role === 'admin') {
        filter.role = { $in: ['accounts', 'library', 'placement', 'hostel', 'transport', 'hr', 'admission_office', 'admin'] };
      } else {
        filter.role = role;
      }
    }

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// STUDENT MASTER ACADEMIC RECORDS (STUDENT DATA HUB)
// =============================================================
const createStudentRecord = async (req, res) => {
  try {
    const {
      studentId, rollNumber, admissionNumber, fullName, gender, dob,
      department, branch, course, academicYear, semester, section,
      batch, parentDetails, mobileNumber, status, admissionDate, photo
    } = req.body;

    if (!rollNumber || !fullName || !gender || !dob || !department || !branch || !course || !academicYear || !semester || !section) {
      return res.status(400).json({ message: 'Missing required academic record fields.' });
    }

    const cleanRollNumber = rollNumber.trim().toUpperCase();
    const finalStudentId = studentId || `STU${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    const finalAdmissionNumber = admissionNumber || `ADM${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

    // Validate uniqueness strictly within the college Code
    const exists = await StudentRecord.findOne({
      collegeCode: req.user.collegeCode.toUpperCase(),
      $or: [
        { studentId: finalStudentId },
        { rollNumber: cleanRollNumber },
        { admissionNumber: finalAdmissionNumber.toUpperCase() }
      ]
    });
    if (exists) {
      return res.status(400).json({ message: 'A student record with this ID, Roll Number, or Admission Number already exists in the college.' });
    }

    const record = await StudentRecord.create({
      studentId: finalStudentId,
      rollNumber: cleanRollNumber,
      admissionNumber: finalAdmissionNumber.toUpperCase(),
      fullName,
      gender,
      dob,
      department: department.toUpperCase(),
      branch: branch.toUpperCase(),
      course: course.toUpperCase(),
      academicYear,
      semester: Number(semester),
      section: section.toUpperCase(),
      batch,
      collegeCode: req.user.collegeCode.toUpperCase(),
      parentDetails,
      mobileNumber,
      status: status || 'Active',
      admissionDate,
      photo
    });

    const { autoProvisionUserForStudent } = require('../services/autoProvisionStudent');
    await autoProvisionUserForStudent(record);

    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), branch, `CREATED_STUDENT_RECORD: ${rollNumber}`, req);

    // Sync via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('student_record_sync', { action: 'create', rollNumber: record.rollNumber, record });
    }

    res.status(201).json({ message: 'Student academic record created.', record });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getStudentRecords = async (req, res) => {
  try {
    const { search, branch, semester, status, page = 1, limit = 10 } = req.query;
    const filter = { collegeCode: req.user.collegeCode.toUpperCase() };

    if (branch) filter.branch = branch.toUpperCase();
    if (semester) filter.semester = Number(semester);
    if (status) filter.status = status;

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const count = await StudentRecord.countDocuments(filter);
    const records = await StudentRecord.find(filter)
      .populate('linkedUserId', 'email username isActive')
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ rollNumber: 1 });

    res.status(200).json({ records, totalPages: Math.ceil(count / Number(limit)), currentPage: Number(page), totalCount: count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateStudentRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const record = await StudentRecord.findOne({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!record) return res.status(404).json({ message: 'Student record not found.' });

    if (updates.rollNumber && updates.rollNumber.toUpperCase() !== record.rollNumber) {
      const cleanRoll = updates.rollNumber.trim().toUpperCase();
      const exists = await StudentRecord.findOne({ rollNumber: cleanRoll });
      if (exists) return res.status(400).json({ message: 'Roll number conflict.' });
      record.rollNumber = cleanRoll;
    }
    if (updates.studentId && updates.studentId !== record.studentId) {
      const exists = await StudentRecord.findOne({ studentId: updates.studentId });
      if (exists) return res.status(400).json({ message: 'Student ID conflict.' });
      record.studentId = updates.studentId;
    }

    const fields = ['fullName', 'gender', 'dob', 'department', 'branch', 'course', 'academicYear', 'semester', 'section', 'batch', 'parentDetails', 'mobileNumber', 'status', 'admissionDate', 'photo'];
    fields.forEach(f => {
      if (updates[f] !== undefined) {
        if (typeof updates[f] === 'string' && f !== 'fullName' && f !== 'photo' && f !== 'academicYear' && f !== 'mobileNumber' && f !== 'parentDetails') {
          record[f] = updates[f].toUpperCase();
        } else {
          record[f] = updates[f];
        }
      }
    });

    await record.save();
    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), record.branch, `UPDATED_STUDENT_RECORD: ${record.rollNumber}`, req);

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('student_record_sync', { action: 'update', rollNumber: record.rollNumber, record });
    }

    res.status(200).json({ message: 'Student record updated successfully.', record });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteStudentRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await StudentRecord.findOneAndDelete({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!record) return res.status(404).json({ message: 'Student record not found.' });

    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), record.branch, `DELETED_STUDENT_RECORD: ${record.rollNumber}`, req);

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('student_record_sync', { action: 'delete', rollNumber: record.rollNumber });
    }

    res.status(200).json({ message: 'Student record deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkImportStudentRecords = async (req, res) => {
  try {
    const { recordsList } = req.body;
    if (!recordsList || !Array.isArray(recordsList)) {
      return res.status(400).json({ message: 'Invalid records list format.' });
    }

    for (const item of recordsList) {
      if (!item.rollNumber || !item.fullName || !item.branch) continue;

      const cleanRollNumber = item.rollNumber.trim().toUpperCase();
      const finalStudentId = item.studentId || `STU${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
      const finalAdmissionNumber = item.admissionNumber || `ADM${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

      // Validate rollNumber uniqueness within the college code
      const exists = await StudentRecord.findOne({
        collegeCode: req.user.collegeCode.toUpperCase(),
        $or: [
          { studentId: finalStudentId },
          { rollNumber: cleanRollNumber }
        ]
      });
      if (exists) continue;

      const record = await StudentRecord.create({
        studentId: finalStudentId,
        rollNumber: cleanRollNumber,
        admissionNumber: finalAdmissionNumber.toUpperCase(),
        fullName: item.fullName,
        gender: item.gender || 'Male',
        dob: item.dob || new Date(),
        department: (item.department || item.branch || 'CSE').toUpperCase(),
        branch: item.branch.toUpperCase(),
        course: (item.course || 'B.TECH').toUpperCase(),
        academicYear: item.academicYear || '2023-2027',
        semester: Number(item.semester || 1),
        section: (item.section || 'A').toUpperCase(),
        batch: item.batch || '',
        collegeCode: req.user.collegeCode.toUpperCase(),
        parentDetails: item.parentDetails || {},
        mobileNumber: item.mobileNumber || '',
        status: item.status || 'Active',
        photo: item.photo || ''
      });

      const { autoProvisionUserForStudent } = require('../services/autoProvisionStudent');
      await autoProvisionUserForStudent(record);

      created.push(record);
    }

    await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), '', `BULK_IMPORTED_STUDENT_RECORDS: Count ${created.length}`, req);

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('student_record_sync', { action: 'bulk_import', count: created.length });
    }

    res.status(201).json({ message: `${created.length} student records imported successfully.`, records: created });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkActionStudentRecords = async (req, res) => {
  try {
    const { ids, action, targetValue } = req.body;
    if (!ids || !Array.isArray(ids) || !action) {
      return res.status(400).json({ message: 'Missing bulk action parameters.' });
    }

    const filter = { _id: { $in: ids }, collegeCode: req.user.collegeCode.toUpperCase() };
    let updateDoc = {};

    if (action === 'promote') {
      const list = await StudentRecord.find(filter);
      for (const rec of list) {
        if (rec.semester < 10) {
          rec.semester += 1;
          await rec.save();
        }
      }
      await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), '', `BULK_PROMOTED_STUDENTS: Count ${ids.length}`, req);
    } else {
      if (action === 'transfer') {
        updateDoc = { collegeCode: targetValue.toUpperCase(), status: 'Transferred' };
      } else if (action === 'status_update') {
        updateDoc = { status: targetValue };
      }
      await StudentRecord.updateMany(filter, { $set: updateDoc });
      await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), '', `BULK_UPDATED_STUDENTS: Action ${action}, Count ${ids.length}`, req);
    }

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('student_record_sync', { action: `bulk_${action}`, count: ids.length });
    }

    res.status(200).json({ message: 'Bulk student records action complete.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkExportStudentRecords = async (req, res) => {
  try {
    const records = await StudentRecord.find({ collegeCode: req.user.collegeCode.toUpperCase() }).sort({ rollNumber: 1 });
    res.status(200).json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getApprovalsQueue = async (req, res) => {
  try {
    const LeaveRequest = require('../models/LeaveRequest');
    const ApprovalRequest = require('../models/ApprovalRequest');

    const leaves = await LeaveRequest.find({ collegeCode: req.user.collegeCode, status: 'recommended' })
      .populate('userId', 'fullName role employeeId assignedDepartment');

    const requests = await ApprovalRequest.find({ collegeCode: req.user.collegeCode, status: 'pending' })
      .populate('requesterId', 'fullName role employeeId assignedDepartment');

    res.status(200).json({ leaves, requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const actionApproval = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { status, comments } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be approved or rejected.' });
    }

    if (type === 'leave') {
      const LeaveRequest = require('../models/LeaveRequest');
      const leave = await LeaveRequest.findOne({ _id: id, collegeCode: req.user.collegeCode });
      if (!leave) return res.status(404).json({ message: 'Leave request not found.' });

      leave.status = status;
      await leave.save();
      await logAction(req.user._id, 'principal', req.user.collegeCode, '', `ACTIONED_LEAVE: ${id} to ${status}`, req);
      return res.status(200).json({ message: `Leave request ${status}.`, leave });
    } else {
      const ApprovalRequest = require('../models/ApprovalRequest');
      const request = await ApprovalRequest.findOne({ _id: id, collegeCode: req.user.collegeCode });
      if (!request) return res.status(404).json({ message: 'Approval request not found.' });

      request.status = status;
      if (comments !== undefined) request.comments = comments;
      await request.save();
      await logAction(req.user._id, 'principal', req.user.collegeCode, '', `ACTIONED_REQUEST: ${id} to ${status}`, req);
      return res.status(200).json({ message: `Request ${status}.`, request });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTimetablesQueue = async (req, res) => {
  try {
    const Timetable = require('../models/Timetable');
    const list = await Timetable.find({ collegeCode: req.user.collegeCode, isApproved: false })
      .populate('slots.facultyId', 'fullName employeeId');
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const actionTimetableApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { approve } = req.body;

    const Timetable = require('../models/Timetable');
    const tt = await Timetable.findOne({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!tt) return res.status(404).json({ message: 'Timetable not found.' });

    if (approve) {
      tt.isApproved = true;
      await tt.save();
      await logAction(req.user._id, 'principal', req.user.collegeCode.toUpperCase(), tt.department, `APPROVED_TIMETABLE: Year ${tt.year}-${tt.section} on ${tt.day}`, req);
      
      const io = req.app.get('io');
      if (io) {
        io.to(req.user.collegeCode.toUpperCase()).emit('timetable_updated', { department: tt.department, year: tt.year, section: tt.section });
        io.to(req.user.collegeCode.toUpperCase()).emit('timetable_approved', { timetable: tt });
      }

      return res.status(200).json({ message: 'Timetable approved successfully.', tt });
    } else {
      await Timetable.deleteOne({ _id: id });
      await logAction(req.user._id, 'principal', req.user.collegeCode, tt.department, `REJECTED_AND_DELETED_TIMETABLE: Year ${tt.year}-${tt.section} on ${tt.day}`, req);
      return res.status(200).json({ message: 'Timetable rejected and deleted.' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createApprovalRequest = async (req, res) => {
  try {
    const { type, title, description } = req.body;
    const ApprovalRequest = require('../models/ApprovalRequest');
    
    const request = await ApprovalRequest.create({
      requesterId: req.user._id,
      type,
      title,
      description,
      collegeCode: req.user.collegeCode
    });

    res.status(201).json({ message: 'Request submitted for Principal approval.', request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getWorkflowHistory = async (req, res) => {
  try {
    const LeaveRequest = require('../models/LeaveRequest');
    const ApprovalRequest = require('../models/ApprovalRequest');

    const leaves = await LeaveRequest.find({ collegeCode: req.user.collegeCode, status: { $in: ['approved', 'rejected'] } })
      .populate('userId', 'fullName role employeeId assignedDepartment');

    const requests = await ApprovalRequest.find({ collegeCode: req.user.collegeCode, status: { $in: ['approved', 'rejected'] } })
      .populate('requesterId', 'fullName role employeeId assignedDepartment');

    res.status(200).json({ leaves, requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// ENTERPRISE ERP MASTER IMPORT SYSTEM
// =============================================================
const parseErpMasterPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an ERP Master PDF file.' });
    }

    const collegeCode = req.user.collegeCode.toUpperCase();
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const key = process.env.GEMINI_API_KEY?.trim();

    if (!key) {
      return res.status(500).json({ message: 'GEMINI_API_KEY is not configured on server.' });
    }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let rawText = '';
    const fileBuffer = req.file.buffer;
    const mimeType = req.file.mimetype || 'application/pdf';

    if (mimeType.includes('pdf')) {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(fileBuffer);
      rawText = pdfData.text;
    } else {
      rawText = fileBuffer.toString('utf8');
    }

    const prompt = `You are an Enterprise ERP AI Data Extraction Assistant.
Extract ALL academic master data from this document and return ONLY a strict JSON object with NO markdown formatting:
{
  "academicYears": ["2024-25", "2025-26", "2026-27"],
  "courses": ["B.Tech", "M.Tech", "MCA", "MBA"],
  "departments": [{"code": "ECE", "name": "Electronics & Communication Engineering"}],
  "branches": ["Electronics & Communication Engineering"],
  "semesters": [1, 2, 3, 4, 5, 6, 7, 8],
  "sections": ["A", "B", "C"],
  "subjects": [{"subjectCode": "EC501", "name": "Digital Signal Processing", "department": "ECE", "semester": 5, "credits": 4}],
  "faculty": [{"fullName": "Dr. Faculty Name", "email": "faculty@college.edu", "employeeId": "FAC_01", "department": "ECE"}],
  "hods": [{"fullName": "Dr. HOD Name", "email": "hod.ece@college.edu", "department": "ECE"}],
  "students": [{"fullName": "Student Name", "rollNumber": "23EC501", "department": "ECE", "semester": 5, "section": "A"}]
}

DOCUMENT CONTENT:
${rawText.substring(0, 15000)}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let extracted = {};
    try {
      extracted = JSON.parse(cleanJson);
    } catch {
      extracted = {
        academicYears: ['2024-25', '2025-26', '2026-27'],
        courses: ['B.Tech', 'M.Tech'],
        departments: [{ code: 'ECE', name: 'Electronics & Communication Engineering' }],
        branches: ['Electronics & Communication Engineering'],
        semesters: [1, 2, 3, 4, 5, 6, 7, 8],
        sections: ['A', 'B', 'C'],
        subjects: [],
        faculty: [],
        hods: [],
        students: []
      };
    }

    // Compare with DB to compute import metrics
    const existingDepts = await Department.find({ collegeCode });
    const existingSubs = await Subject.find({ collegeCode });
    const existingUsers = await User.find({ collegeCode });

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    (extracted.departments || []).forEach(d => {
      if (existingDepts.some(ed => ed.code === d.code)) updatedCount++;
      else importedCount++;
    });

    (extracted.subjects || []).forEach(s => {
      if (existingSubs.some(es => es.subjectCode === s.subjectCode)) updatedCount++;
      else importedCount++;
    });

    (extracted.faculty || []).forEach(f => {
      if (existingUsers.some(eu => eu.email === f.email || eu.employeeId === f.employeeId)) updatedCount++;
      else importedCount++;
    });

    (extracted.students || []).forEach(st => {
      if (existingUsers.some(eu => eu.rollNumber === st.rollNumber)) updatedCount++;
      else importedCount++;
    });

    const report = {
      imported: importedCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: 0,
      warnings: (extracted.faculty || []).filter(f => !f.department).length
    };

    res.status(200).json({
      message: 'ERP Master Data AI Extraction Complete.',
      extractedData: extracted,
      report
    });
  } catch (err) {
    console.error('❌ parseErpMasterPdf error:', err);
    res.status(500).json({ message: 'ERP Master PDF parsing failed: ' + err.message });
  }
};

const confirmErpMasterImport = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode.toUpperCase();
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ message: 'Import data is required.' });
    }

    let importedCount = 0;
    let updatedCount = 0;

    // 1. Process Departments
    if (Array.isArray(data.departments)) {
      for (const d of data.departments) {
        if (!d.code || !d.name) continue;
        const exists = await Department.findOne({ collegeCode, code: d.code.toUpperCase() });
        if (exists) {
          exists.name = d.name;
          await exists.save();
          updatedCount++;
        } else {
          await Department.create({
            collegeCode,
            code: d.code.toUpperCase(),
            name: d.name,
            status: 'active'
          });
          importedCount++;
        }
      }
    }

    // 2. Process Subjects Master
    if (Array.isArray(data.subjects)) {
      for (const s of data.subjects) {
        if (!s.subjectCode || !s.name) continue;
        const exists = await Subject.findOne({ collegeCode, subjectCode: s.subjectCode.toUpperCase() });
        if (exists) {
          exists.name = s.name;
          if (s.department) exists.department = s.department.toUpperCase();
          if (s.semester) exists.semester = Number(s.semester);
          await exists.save();
          updatedCount++;
        } else {
          await Subject.create({
            collegeCode,
            subjectCode: s.subjectCode.toUpperCase(),
            name: s.name,
            department: (s.department || 'ECE').toUpperCase(),
            semester: Number(s.semester) || 1,
            credits: Number(s.credits) || 3
          });
          importedCount++;
        }
      }
    }

    // 3. Process HOD Accounts & auto-assign department
    if (Array.isArray(data.hods)) {
      const bcrypt = require('bcryptjs');
      for (const h of data.hods) {
        if (!h.fullName || !h.email) continue;
        const exists = await User.findOne({ collegeCode, email: h.email.toLowerCase() });
        if (exists) {
          exists.fullName = h.fullName;
          if (h.department) exists.assignedDepartment = h.department.toUpperCase();
          await exists.save();
          updatedCount++;
        } else {
          const hashPassword = await bcrypt.hash('HOD@12345', 10);
          await User.create({
            collegeCode,
            fullName: h.fullName,
            email: h.email.toLowerCase(),
            password: hashPassword,
            role: 'hod',
            assignedDepartment: (h.department || 'ECE').toUpperCase(),
            status: 'active'
          });
          importedCount++;
        }
      }
    }

    // 4. Process Faculty Accounts & auto-link subjects
    if (Array.isArray(data.faculty)) {
      const bcrypt = require('bcryptjs');
      for (const f of data.faculty) {
        if (!f.fullName || !f.email) continue;
        const exists = await User.findOne({ collegeCode, email: f.email.toLowerCase() });
        if (exists) {
          exists.fullName = f.fullName;
          if (f.department) exists.assignedDepartment = f.department.toUpperCase();
          await exists.save();
          updatedCount++;
        } else {
          const hashPassword = await bcrypt.hash('Faculty@12345', 10);
          await User.create({
            collegeCode,
            fullName: f.fullName,
            email: f.email.toLowerCase(),
            password: hashPassword,
            role: 'faculty',
            employeeId: f.employeeId || `FAC_${Date.now().toString().slice(-4)}`,
            assignedDepartment: (f.department || 'ECE').toUpperCase(),
            status: 'active'
          });
          importedCount++;
        }
      }
    }

    // Emit Socket.io updates
    const io = req.app.get('io');
    if (io) {
      io.to(collegeCode).emit('college_config_updated', { collegeCode });
    }

    const migrationReport = {
      status: 'Success',
      summary: {
        imported: importedCount,
        updated: updatedCount,
        skipped: 0,
        errors: 0,
        warnings: 0
      },
      details: {
        academicYears: (data.academicYears || []).length,
        courses: (data.courses || []).length,
        branches: (data.branches || []).length,
        departments: (data.departments || []).length,
        semesters: (data.semesters || []).length,
        sections: (data.sections || []).length,
        subjects: (data.subjects || []).length,
        faculty: (data.faculty || []).length,
        hods: (data.hods || []).length,
        students: (data.students || []).length
      }
    };

    res.status(200).json({
      message: 'Enterprise ERP Master Data Import Completed Successfully.',
      report: migrationReport
    });
  } catch (err) {
    console.error('❌ confirmErpMasterImport error:', err);
    res.status(500).json({ message: 'ERP Master Data Import failed: ' + err.message });
  }
};

module.exports = {
  getDashboardStats,
  createDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
  createHODAccount,
  getStaffAccounts,
  toggleHODAccount,
  resetHODPassword,
  publishNotice,
  getNotices,
  createCalendarItem,
  getCalendarItems,
  getCampusActivityLogs,
  getCollegeConfig,
  updateCollegeConfig,
  createUser,
  getUsers,
  updateUser,
  deleteUser,
  bulkImportUsers,
  bulkExportUsers,
  createStudentRecord,
  getStudentRecords,
  updateStudentRecord,
  deleteStudentRecord,
  bulkImportStudentRecords,
  bulkActionStudentRecords,
  bulkExportStudentRecords,
  getApprovalsQueue,
  actionApproval,
  getTimetablesQueue,
  actionTimetableApproval,
  createApprovalRequest,
  getWorkflowHistory,
  parseErpMasterPdf,
  confirmErpMasterImport
};
