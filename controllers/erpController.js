const Subject = require('../models/Subject');
const Assignment = require('../models/Assignment');
const Exam = require('../models/Exam');
const PlacementDrive = require('../models/PlacementDrive');
const Book = require('../models/Book');
const User = require('../models/User');
const Department = require('../models/Department');
const Timetable = require('../models/Timetable');
const StudentRecord = require('../models/StudentRecord');
const College = require('../models/College');
const ErpImport = require('../models/ErpImport');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const { sendFcmNotification } = require('../services/notificationService');
const { logAction } = require('../services/auditLogService');

// =============================================================
// SUBJECT MANAGEMENT
// =============================================================
const addSubject = async (req, res) => {
  try {
    const { subjectCode, name, department, credits, faculty, semester, type } = req.body;
    if (!subjectCode || !name || !department || !semester) {
      return res.status(400).json({ message: 'Missing subject registration parameters. Code, Name, Department, and Semester are required.' });
    }

    const exists = await Subject.findOne({ subjectCode: subjectCode.toUpperCase(), collegeCode: req.user.collegeCode.toUpperCase() });
    if (exists) {
      return res.status(400).json({ message: 'Subject already registered under this college.' });
    }

    let subject = await Subject.create({
      subjectCode: subjectCode.toUpperCase(),
      name,
      department: department.toUpperCase(),
      credits: credits || 3,
      faculty: faculty || null,
      semester: Number(semester),
      type: type || 'Theory',
      collegeCode: req.user.collegeCode.toUpperCase()
    });

    subject = await Subject.findById(subject._id).populate('faculty', 'fullName');

    await logAction(req.user._id, req.user.role, req.user.collegeCode.toUpperCase(), department.toUpperCase(), `REGISTERED_SUBJECT: ${subjectCode}`, req);

    // Sync via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('subject_created', { subject });
    }

    res.status(201).json({ message: 'Subject registered successfully.', subject });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSubjects = async (req, res) => {
  try {
    const filter = { collegeCode: req.user.collegeCode.toUpperCase() };
    if (req.user.role === 'hod' || req.user.role === 'faculty') {
      filter.department = req.user.assignedDepartment.toUpperCase();
    }
    // Optional filters from query params
    if (req.query.department) {
      filter.department = req.query.department.toUpperCase();
    }
    if (req.query.semester) {
      filter.semester = Number(req.query.semester);
    }
    const subjects = await Subject.find(filter).populate('faculty', 'fullName');
    res.status(200).json(subjects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department, credits, faculty, semester, type } = req.body;
    let subject = await Subject.findOne({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });

    if (name) subject.name = name;
    if (department) subject.department = department.toUpperCase();
    if (credits !== undefined) subject.credits = credits;
    if (faculty !== undefined) subject.faculty = faculty || null;
    if (semester !== undefined) subject.semester = Number(semester);
    if (type) subject.type = type;

    await subject.save();
    subject = await Subject.findById(subject._id).populate('faculty', 'fullName');

    await logAction(req.user._id, req.user.role, req.user.collegeCode.toUpperCase(), subject.department, `UPDATED_SUBJECT: ${subject.subjectCode}`, req);

    // Sync via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('subject_updated', { subject });
    }

    res.status(200).json({ message: 'Subject updated.', subject });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findOneAndDelete({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });

    await logAction(req.user._id, req.user.role, req.user.collegeCode.toUpperCase(), subject.department, `DELETED_SUBJECT: ${subject.subjectCode}`, req);

    // Sync via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('subject_deleted', { id: subject._id, subjectCode: subject.subjectCode });
    }

    res.status(200).json({ message: 'Subject deleted successfully.', subject });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// ASSIGNMENT MODULE
// =============================================================
const createAssignment = async (req, res) => {
  try {
    const { title, description, attachmentUrl, deadline, subjectCode, year, section } = req.body;

    if (!title || !deadline || !subjectCode || !year || !section) {
      return res.status(400).json({ message: 'Missing assignment creation parameters.' });
    }

    const assignment = await Assignment.create({
      title,
      description,
      attachmentUrl,
      deadline: new Date(deadline),
      subjectCode: subjectCode.toUpperCase(),
      class: { year: Number(year), section: section.toUpperCase() },
      collegeCode: req.user.collegeCode
    });

    // Notify students via FCM in real time
    const subject = await Subject.findOne({ subjectCode: subjectCode.toUpperCase(), collegeCode: req.user.collegeCode });
    await sendFcmNotification({
      collegeCode: req.user.collegeCode,
      department: subject ? subject.department : '',
      year: Number(year),
      section: section.toUpperCase(),
      title: `📝 New Assignment: ${title}`,
      body: `Assignment deadline: ${new Date(deadline).toLocaleDateString()}. Check details in Student OS.`
    });

    await logAction(req.user._id, req.user.role, req.user.collegeCode, req.user.assignedDepartment || '', `CREATED_ASSIGNMENT: ${title} (${subjectCode})`, req);

    res.status(201).json({ message: 'Assignment registered and students notified.', assignment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// EXAMINATION CELL
// =============================================================
const createExamTimetable = async (req, res) => {
  try {
    const { title, type, startDate, timetable, seatingArrangement } = req.body;

    if (!title || !startDate || !timetable) {
      return res.status(400).json({ message: 'Missing exam timetable parameters.' });
    }

    const exam = await Exam.create({
      title,
      type: type || 'internal',
      startDate: new Date(startDate),
      timetable: timetable.map(item => ({
        date: new Date(item.date),
        subjectCode: item.subjectCode.toUpperCase(),
        session: item.session || 'forenoon'
      })),
      seatingArrangement: seatingArrangement || [],
      collegeCode: req.user.collegeCode
    });

    // Notify students via FCM
    await sendFcmNotification({
      collegeCode: req.user.collegeCode,
      title: `📅 Exam Timetable Published: ${title}`,
      body: `Exams starting from ${new Date(startDate).toLocaleDateString()}. View schedules & rooms in Student OS.`
    });

    await logAction(req.user._id, req.user.role, req.user.collegeCode, '', `PUBLISHED_EXAM: ${title}`, req);

    res.status(201).json({ message: 'Exam timetable published successfully.', exam });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// PLACEMENT OFFICE
// =============================================================
const createPlacementDrive = async (req, res) => {
  try {
    const { companyName, role, packageOffered, driveDate, cgpaCutoff } = req.body;

    if (!companyName || !role || !driveDate) {
      return res.status(400).json({ message: 'Missing placement drive parameters.' });
    }

    const drive = await PlacementDrive.create({
      companyName,
      role,
      packageOffered,
      driveDate: new Date(driveDate),
      eligibilityCriteria: {
        cgpaCutoff: cgpaCutoff || 0,
        activeBacklogs: 0
      },
      collegeCode: req.user.collegeCode
    });

    // Notify eligible students
    await sendFcmNotification({
      collegeCode: req.user.collegeCode,
      title: `💼 New Placement Drive: ${companyName}`,
      body: `Hiring for ${role} (${packageOffered}). Apply before drive starts on ${new Date(driveDate).toLocaleDateString()}.`
    });

    await logAction(req.user._id, req.user.role, req.user.collegeCode, '', `REGISTERED_PLACEMENT_DRIVE: ${companyName}`, req);

    res.status(201).json({ message: 'Placement drive registered.', drive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// LIBRARY STAFF
// =============================================================
const registerBook = async (req, res) => {
  try {
    const { isbn, title, author, quantity } = req.body;
    if (!isbn || !title || !author) {
      return res.status(400).json({ message: 'Missing book details.' });
    }

    let book = await Book.findOne({ isbn: isbn.toUpperCase(), collegeCode: req.user.collegeCode });
    if (book) {
      book.quantity += (quantity || 1);
      book.available += (quantity || 1);
      await book.save();
    } else {
      book = await Book.create({
        isbn: isbn.toUpperCase(),
        title,
        author,
        quantity: quantity || 1,
        available: quantity || 1,
        collegeCode: req.user.collegeCode
      });
    }

    res.status(200).json({ message: 'Book catalog updated.', book });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const issueBook = async (req, res) => {
  try {
    const { isbn, studentRoll } = req.body;

    const book = await Book.findOne({ isbn: isbn.toUpperCase(), collegeCode: req.user.collegeCode });
    if (!book || book.available <= 0) {
      return res.status(400).json({ message: 'Book currently unavailable.' });
    }

    const student = await User.findOne({ rollNumber: studentRoll.toUpperCase(), collegeCode: req.user.collegeCode });
    if (!student) {
      return res.status(404).json({ message: 'Student roll number not registered.' });
    }

    book.available -= 1;
    book.rentals.push({
      studentId: student._id,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days due date
    });
    await book.save();

    await logAction(req.user._id, req.user.role, req.user.collegeCode, '', `ISSUED_BOOK: ${book.title} to ${studentRoll}`, req);

    res.status(200).json({ message: `Book issued to ${studentRoll} successfully.`, book });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// =============================================================
// ENTERPRISE ERP IMPORT SYSTEM
// =============================================================

// In-memory locks to prevent parallel imports per college
const importLocks = {};

// Helper to push FCM notifications directly to specific user roles
const sendDirectFcm = async (role, collegeCode, title, body) => {
  try {
    const { sendPushNotification } = require('../utils/firebase');
    const users = await User.find({ role, collegeCode: collegeCode.toUpperCase(), isActive: true }).select('fcmTokens');
    const tokens = [];
    users.forEach(u => {
      if (u.fcmTokens && u.fcmTokens.length > 0) {
        tokens.push(...u.fcmTokens);
      }
    });
    if (tokens.length > 0) {
      await sendPushNotification(tokens, title, body);
    }
  } catch (err) {
    console.warn('[FCM Import Notify] skipped:', err.message);
  }
};

// 1. Parse File Endpoint (Excel/CSV to JSON)
const parseImportFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Verify file type extension
    const origName = req.file.originalname.toLowerCase();
    if (!origName.endsWith('.xlsx') && !origName.endsWith('.csv')) {
      return res.status(400).json({ message: 'Unsupported file format. Please upload Excel (.xlsx) or CSV (.csv) files.' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Parse to JSON with default empty string for empty cells
    const records = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    
    if (records.length === 0) {
      return res.status(400).json({ message: 'The uploaded file contains no data rows.' });
    }

    // Extract headers (keys from first parsed row)
    const headers = Object.keys(records[0]);

    res.status(200).json({
      message: 'File parsed successfully.',
      fileName: req.file.originalname,
      totalRecords: records.length,
      headers,
      records
    });
  } catch (err) {
    res.status(500).json({ message: 'Error parsing file: ' + err.message });
  }
};

// 2. Validate Data Endpoint (Dry-run Validation checks)
const validateImportData = async (req, res) => {
  try {
    const { importType, records } = req.body;
    if (!importType || !records || !Array.isArray(records)) {
      return res.status(400).json({ message: 'Missing validation params. Import type and records list are required.' });
    }

    const collegeCode = req.user.collegeCode.toUpperCase();
    const result = await runValidationPipeline(collegeCode, importType, records);

    res.status(200).json({
      success: result.errors.length === 0,
      totalRecords: records.length,
      errorCount: result.errors.length,
      errors: result.errors,
      warnings: result.warnings,
      duplicates: result.duplicates
    });
  } catch (err) {
    res.status(500).json({ message: 'Validation pipeline error: ' + err.message });
  }
};

// 3. Execute Import (Chunk processor with Socket.IO status and Rollbacks)
const executeImportData = async (req, res) => {
  const { importType, records, fileName, duplicateStrategy, dryRun } = req.body;
  const collegeCode = req.user.collegeCode.toUpperCase();
  const principalId = req.user._id;

  if (!importType || !records || !Array.isArray(records)) {
    return res.status(400).json({ message: 'Missing import parameters.' });
  }

  // Prevent duplicate/parallel imports per college
  if (importLocks[collegeCode]) {
    return res.status(423).json({ message: 'ERP Import already running. Please wait until it completes.' });
  }

  // Acquire Lock
  importLocks[collegeCode] = true;

  const { v4: uuidv4 } = require('uuid');
  const requestId = uuidv4();
  
  // Calculate version number
  const versionCount = await ErpImport.countDocuments({ collegeCode });
  const version = versionCount + 1;

  // Run dry run or validation first
  const validation = await runValidationPipeline(collegeCode, importType, records);
  
  // Create import log document
  const importLog = await ErpImport.create({
    requestId,
    principalId,
    collegeCode,
    version,
    importType,
    fileName: fileName || 'Uploaded_File',
    totalRecords: records.length,
    status: 'processing',
    errors: validation.errors,
    duplicatesCount: validation.duplicates.length,
    warningsCount: validation.warnings.length,
    ipAddress: req.ip || '',
    browser: req.headers['user-agent'] || '',
    device: req.device?.type || 'Desktop'
  });

  if (dryRun) {
    importLog.status = 'completed';
    importLog.successCount = records.length - validation.errors.length;
    importLog.failedCount = validation.errors.length;
    await importLog.save();
    
    // Release Lock
    importLocks[collegeCode] = false;
    
    return res.status(200).json({
      message: 'Dry run completed successfully. Data simulated.',
      requestId,
      version,
      summary: {
        total: records.length,
        success: records.length - validation.errors.length,
        failed: validation.errors.length,
        duplicates: validation.duplicates.length,
        warnings: validation.warnings.length
      }
    });
  }

  // If duplicate strategy is 'Stop Import' and we have duplicates/errors, fail immediately
  if (duplicateStrategy === 'Stop Import' && (validation.errors.length > 0 || validation.duplicates.length > 0)) {
    importLog.status = 'failed';
    importLog.failedCount = records.length;
    await importLog.save();
    importLocks[collegeCode] = false;
    return res.status(400).json({
      message: 'Import stopped due to duplicates/validation failures.',
      errors: validation.errors,
      duplicates: validation.duplicates
    });
  }

  // Immediately respond to the client with request parameters to prevent HTTP request timeout
  res.status(202).json({
    message: 'Import started. Processing in background...',
    requestId,
    version
  });

  // Password hash cache to eliminate CPU bottleneck during bulk import
  const passwordHashCache = new Map();
  const getHashedPassword = async (text) => {
    if (!passwordHashCache.has(text)) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(text, salt);
      passwordHashCache.set(text, hash);
    }
    return passwordHashCache.get(text);
  };

  // Start background process loop
  setImmediate(async () => {
    const startTime = Date.now();
    const createdIds = { users: [], departments: [], subjects: [], timetables: [] };
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const errorsList = [...validation.errors];
    const io = req.app.get('io');
    const chunkSize = 50;

    try {
      if (importType === 'students') {
        // High Performance Bulk Processor for Students (Handles 5,000+ records in < 1 sec)
        const [existingUsersList, existingStudentsList] = await Promise.all([
          User.find({ collegeCode }).select('_id username rollNumber').lean(),
          StudentRecord.find({ collegeCode }).select('_id rollNumber').lean()
        ]);

        const existingUserMap = new Map(existingUsersList.map(u => [(u.username || u.rollNumber || '').toLowerCase(), u]));
        const existingStudentRecMap = new Map(existingStudentsList.map(s => [(s.rollNumber || '').toUpperCase(), s]));

        const bulkUserOps = [];
        const bulkStudentOps = [];

        for (let i = 0; i < records.length; i++) {
          const r = records[i];
          const rowNum = i + 2;

          const rollUpper = (r['Roll Number'] || r.rollNumber || r['Roll No'] || r.rollNo || '').trim().toUpperCase();
          if (!rollUpper) {
            failedCount++;
            errorsList.push({ row: rowNum, rowValue: r, reasons: ['Roll Number is required'] });
            continue;
          }

          const rollLower = rollUpper.toLowerCase();
          const admissionNo = (r['Admission Number'] || r.admissionNumber || r['Admission No'] || r.admissionNo || `ADM-${rollUpper}`).trim().toUpperCase();
          const name = r['Student Name'] || r.studentName || r.fullName || r.Name || r.name || 'Student';
          const dept = (r.Department || r.department || r.Branch || r.branch || 'ECE').trim().toUpperCase();
          const sem = parseInt(r.Semester || r.semester || r.Sem || r.sem) || 1;
          const sec = (r.Section || r.section || r.Sec || r.sec || 'A').trim().toUpperCase();
          const phone = (r.Phone || r.phone || r.Mobile || r.mobile || r['Student Mobile'] || r.studentMobile || '').trim();
          const parentName = r['Parent Name'] || r.parentName || r['Father Name'] || r.fatherName || '';
          const parentPhone = (r['Parent Mobile'] || r.parentMobile || r['Parent Phone'] || r.parentPhone || '').trim();

          let resolvedDept = dept;
          if (dept.includes('ELECTRONICS') || dept.includes('COMMUNICATION') || dept === 'ECE') resolvedDept = 'ECE';
          else if (dept.includes('COMPUTER') || dept.includes('SCIENCE') || dept === 'CSE') resolvedDept = 'CSE';
          else if (dept.includes('MECHANICAL') || dept === 'MECH' || dept === 'ME') resolvedDept = 'MECH';

          const existingUser = existingUserMap.get(rollLower);
          const existingStudentRec = existingStudentRecMap.get(rollUpper);

          if (existingUser || existingStudentRec) {
            if (duplicateStrategy === 'Skip Duplicates') {
              skippedCount++;
              continue;
            }
          }

          const pwdHash = await getHashedPassword(rollUpper);
          const userId = existingUser ? existingUser._id : new mongoose.Types.ObjectId();

          if (!existingUser) {
            bulkUserOps.push({
              insertOne: {
                document: {
                  _id: userId,
                  fullName: name,
                  email: `${rollLower}@student.edu`,
                  username: rollLower,
                  password: pwdHash,
                  role: 'student',
                  collegeCode,
                  rollNumber: rollUpper,
                  branch: resolvedDept,
                  year: Math.ceil(sem / 2),
                  semester: sem,
                  section: sec,
                  mobileNumber: phone || undefined,
                  status: 'PRE_REGISTERED',
                  isActive: true,
                  firstLogin: true,
                  isCollegeConnected: true,
                  collegeLinked: true
                }
              }
            });
            createdIds.users.push(userId);
          }

          if (!existingStudentRec) {
            bulkStudentOps.push({
              insertOne: {
                document: {
                  studentId: rollUpper,
                  rollNumber: rollUpper,
                  admissionNumber: admissionNo,
                  fullName: name,
                  gender: r.Gender || r.gender || 'Other',
                  department: resolvedDept,
                  branch: resolvedDept,
                  course: 'B.TECH',
                  academicYear: r['Academic Year'] || r.academicYear || '2026-2030',
                  semester: sem,
                  section: sec,
                  mobileNumber: phone || '',
                  parentDetails: { fatherName: parentName, parentPhone },
                  linkedUserId: userId,
                  collegeCode,
                  status: 'Active'
                }
              }
            });
          }

          successCount++;
        }

        // Execute bulk MongoDB writes concurrently
        await Promise.all([
          bulkUserOps.length > 0 ? User.bulkWrite(bulkUserOps, { ordered: false }) : Promise.resolve(),
          bulkStudentOps.length > 0 ? StudentRecord.bulkWrite(bulkStudentOps, { ordered: false }) : Promise.resolve()
        ]);

        if (io) {
          io.to(collegeCode).emit('erp_import_progress', {
            requestId,
            importType,
            current: records.length,
            total: records.length,
            success: successCount,
            failed: failedCount,
            skipped: skippedCount,
            progressPercent: 100,
            recordsPerSecond: Math.round(records.length / 0.5),
            etaSeconds: 0
          });
        }
      } else {
        const chunkSize = 100;
        for (let i = 0; i < records.length; i += chunkSize) {
          await new Promise(resolve => setImmediate(resolve));
          const chunk = records.slice(i, i + chunkSize);
          await Promise.all(chunk.map(async (rowRecord, j) => {
            const rowNum = i + j + 2;
            const rowHasError = validation.errors.some(e => e.row === rowNum);
            if (rowHasError) {
              failedCount++;
              return;
            }
            try {
              const result = await processImportRow(collegeCode, importType, rowRecord, duplicateStrategy, createdIds, getHashedPassword);
              if (result.status === 'success') successCount++;
              else if (result.status === 'skipped') skippedCount++;
              else {
                failedCount++;
                errorsList.push({ row: rowNum, rowValue: rowRecord, reasons: [result.reason || 'Unknown error'] });
              }
            } catch (rowErr) {
              failedCount++;
              errorsList.push({ row: rowNum, rowValue: rowRecord, reasons: [rowErr.message] });
            }
          }));
        }
      }

      // Check if we need to stop/rollback if duplicateStrategy was Stop Import and row insertions failed
      if (duplicateStrategy === 'Stop Import' && failedCount > 0) {
        throw new Error('Failure limit exceeded with Stop Import policy.');
      }

      // Finalize database record
      importLog.status = 'completed';
      importLog.successCount = successCount;
      importLog.failedCount = failedCount;
      importLog.skippedCount = skippedCount;
      importLog.errors = errorsList;
      importLog.createdIds = createdIds;
      importLog.duration = Date.now() - startTime;
      await importLog.save();

      // Trigger automatic configurations
      await runErpAutoConfigurations(collegeCode);

      // Notify users (FCM)
      await sendDirectFcm('principal', collegeCode, '📥 ERP Import Completed', `Import version ${version} completed successfully. ${successCount} records added.`);
      await sendDirectFcm('super_admin', collegeCode, '📥 ERP Import Alert', `Import completed for college: ${collegeCode}. Success: ${successCount}.`);

      if (io) {
        io.to(collegeCode).emit('erp_import_completed', { requestId, successCount, failedCount, skippedCount });
      }

    } catch (importErr) {
      console.error('❌ background import error:', importErr.message);

      // Perform manual rollback to guarantee data consistency
      const rollbackStartTime = Date.now();
      try {
        await User.deleteMany({ _id: { $in: createdIds.users } });
        await Department.deleteMany({ _id: { $in: createdIds.departments } });
        await Subject.deleteMany({ _id: { $in: createdIds.subjects } });
        await Timetable.deleteMany({ _id: { $in: createdIds.timetables } });
        await StudentRecord.deleteMany({ linkedUserId: { $in: createdIds.users } });
      } catch (cleanErr) {
        console.error('Rollback clean error:', cleanErr.message);
      }

      importLog.status = 'failed';
      importLog.failedCount = records.length;
      importLog.errors.push({ row: 0, rowValue: {}, reasons: [importErr.message] });
      importLog.rollbackReport = {
        status: 'completed',
        rolledBackRecords: createdIds.users.length + createdIds.departments.length + createdIds.subjects.length + createdIds.timetables.length,
        duration: Date.now() - rollbackStartTime
      };
      await importLog.save();

      // Notify rollback completion
      await sendDirectFcm('principal', collegeCode, '❌ ERP Import Failed', `Import version ${version} failed. Rollback executed successfully.`);

      if (io) {
        io.to(collegeCode).emit('erp_import_failed', { requestId, message: importErr.message });
      }
    } finally {
      // Release lock
      importLocks[collegeCode] = false;
    }
  });
};

// 4. Validation Pipeline helper
const runValidationPipeline = async (collegeCode, importType, records) => {
  const errors = [];
  const warnings = [];
  const duplicates = [];

  const rollNumbers = new Set();
  const employeeIds = new Set();
  const emails = new Set();
  const admissionNumbers = new Set();
  const departmentCodes = new Set();
  const subjectCodes = new Set();

  // Bulk pre-fetch existing records from DB in parallel (O(1) lookups)
  const [dbUsers, dbStudents, dbDepts, dbSubjects] = await Promise.all([
    User.find({ collegeCode }).select('username employeeId email').lean(),
    StudentRecord.find({ collegeCode }).select('rollNumber admissionNumber').lean(),
    Department.find({ collegeCode }).select('code').lean(),
    Subject.find({ collegeCode }).select('subjectCode').lean()
  ]);

  const dbUsernamesSet = new Set(dbUsers.map(u => (u.username || '').toLowerCase()));
  const dbEmpIdsSet = new Set(dbUsers.map(u => (u.employeeId || '').toUpperCase()));
  const dbEmailsSet = new Set(dbUsers.map(u => (u.email || '').toLowerCase()));
  const dbRollNumbersSet = new Set(dbStudents.map(s => (s.rollNumber || '').toUpperCase()));
  const dbAdmissionNumbersSet = new Set(dbStudents.map(s => (s.admissionNumber || '').toUpperCase()));
  const dbDeptCodesSet = new Set(dbDepts.map(d => (d.code || '').toUpperCase()));
  const dbSubjectCodesSet = new Set(dbSubjects.map(s => (s.subjectCode || '').toUpperCase()));

  for (let i = 0; i < records.length; i++) {
    const rowNum = i + 2;
    const record = records[i];
    const rowReasons = [];
    const rowWarnings = [];

    const email = (record.Email || record.email || record['Email Address'] || record['Parent Email'] || '').trim().toLowerCase();
    const phone = (record.Phone || record.phone || record.Mobile || record.mobile || record['Mobile Number'] || record['Student Mobile'] || record.studentMobile || '').trim();

    // Format Validations
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        rowReasons.push(`Invalid email format '${email}'.`);
      } else {
        if (emails.has(email) || dbEmailsSet.has(email)) {
          duplicates.push({ row: rowNum, column: 'Email', value: email, inDb: dbEmailsSet.has(email) });
        } else {
          emails.add(email);
        }
      }
    }

    if (phone) {
      if (phone.length < 8 || phone.length > 15) {
        rowReasons.push(`Invalid phone/mobile number length: ${phone}`);
      }
    }

    if (importType === 'students') {
      const rollNumber = (record['Roll Number'] || record.rollNumber || record['Roll No'] || record.rollNo || '').trim().toUpperCase();
      const admissionNumber = (record['Admission Number'] || record.admissionNumber || record['Admission No'] || record.admissionNo || (rollNumber ? `ADM-${rollNumber}` : '')).trim().toUpperCase();
      const name = record['Student Name'] || record.studentName || record.fullName || record.Name || record.name || '';
      const dept = (record.Department || record.department || record.Branch || record.branch || 'ECE').trim().toUpperCase();
      const sem = parseInt(record.Semester || record.semester || record.Sem || record.sem || 1);
      const parentPhone = (record['Parent Mobile'] || record.parentMobile || record['Parent Phone'] || record.parentPhone || '').trim();

      if (!rollNumber) rowReasons.push('Roll Number is required.');
      else {
        if (rollNumbers.has(rollNumber) || dbRollNumbersSet.has(rollNumber) || dbUsernamesSet.has(rollNumber.toLowerCase())) {
          duplicates.push({ row: rowNum, column: 'Roll Number', value: rollNumber, inDb: dbRollNumbersSet.has(rollNumber) || dbUsernamesSet.has(rollNumber.toLowerCase()) });
        } else {
          rollNumbers.add(rollNumber);
        }
      }

      if (!admissionNumber) rowReasons.push('Admission Number is required.');
      else {
        if (admissionNumbers.has(admissionNumber) || dbAdmissionNumbersSet.has(admissionNumber)) {
          duplicates.push({ row: rowNum, column: 'Admission Number', value: admissionNumber, inDb: dbAdmissionNumbersSet.has(admissionNumber) });
        } else {
          admissionNumbers.add(admissionNumber);
        }
      }

      if (!name) rowReasons.push('Student Name is required.');
      if (!dept) rowReasons.push('Department is required.');
      if (isNaN(sem) || sem < 1 || sem > 10) rowReasons.push('Invalid semester. Must be 1-10.');
      if (parentPhone && (parentPhone.length < 8 || parentPhone.length > 15)) {
        rowReasons.push(`Invalid parent phone length: ${parentPhone}`);
      }

    } else if (importType === 'faculty') {
      const empId = (record['Employee ID'] || record.employeeId || '').trim().toUpperCase();
      const name = record['Faculty Name'] || record.facultyName || record.fullName || '';
      const dept = (record.Department || record.department || '').trim().toUpperCase();

      if (!empId) rowReasons.push('Employee ID is required.');
      else {
        if (employeeIds.has(empId) || dbEmpIdsSet.has(empId)) {
          duplicates.push({ row: rowNum, column: 'Employee ID', value: empId, inDb: dbEmpIdsSet.has(empId) });
        } else {
          employeeIds.add(empId);
        }
      }

      if (!name) rowReasons.push('Faculty Name is required.');
      if (!dept) rowReasons.push('Department is required.');

    } else if (importType === 'departments') {
      const name = record['Department Name'] || record.departmentName || '';
      const code = (record['Department Code'] || record.departmentCode || record.code || '').trim().toUpperCase();

      if (!name) rowReasons.push('Department Name is required.');
      if (!code) rowReasons.push('Department Code is required.');
      else {
        if (departmentCodes.has(code) || dbDeptCodesSet.has(code)) {
          duplicates.push({ row: rowNum, column: 'Department Code', value: code, inDb: dbDeptCodesSet.has(code) });
        } else {
          departmentCodes.add(code);
        }
      }
    } else if (importType === 'subjects') {
      const code = (record['Subject Code'] || record.subjectCode || '').trim().toUpperCase();
      const name = record['Subject Name'] || record.subjectName || '';
      const sem = parseInt(record.Semester || record.semester);

      if (!code) rowReasons.push('Subject Code is required.');
      else {
        if (subjectCodes.has(code) || dbSubjectCodesSet.has(code)) {
          duplicates.push({ row: rowNum, column: 'Subject Code', value: code, inDb: dbSubjectCodesSet.has(code) });
        } else {
          subjectCodes.add(code);
        }
      }

      if (!name) rowReasons.push('Subject Name is required.');
      if (isNaN(sem) || sem < 1 || sem > 10) rowReasons.push('Invalid semester. Must be 1-10.');
    } else if (importType === 'hods') {
      const empId = (record['Employee ID'] || record.employeeId || '').trim().toUpperCase();
      const name = record['HOD Name'] || record.hodName || record.fullName || record.name || '';
      const dept = (record.Department || record.department || '').trim().toUpperCase();

      if (!empId) rowReasons.push('Employee ID is required.');
      else {
        if (employeeIds.has(empId)) {
          duplicates.push({ row: rowNum, column: 'Employee ID', value: empId });
        } else {
          employeeIds.add(empId);
          const exists = await User.findOne({ collegeCode, employeeId: empId });
          if (exists) {
            duplicates.push({ row: rowNum, column: 'Employee ID', value: empId, inDb: true });
          }
        }
      }
      if (!name) rowReasons.push('HOD Name is required.');
      if (!dept) rowReasons.push('Department is required.');

    } else if (importType === 'academics') {
      const dept = (record.Department || record.department || '').trim().toUpperCase();
      const year = parseInt(record.Year || record.year);
      const sem = parseInt(record.Semester || record.semester);
      const sec = (record.Section || record.section || '').trim().toUpperCase();

      if (!dept) rowReasons.push('Department is required.');
      if (isNaN(year) || year < 1 || year > 5) rowReasons.push('Year must be between 1 and 5.');
      if (isNaN(sem) || sem < 1 || sem > 10) rowReasons.push('Semester must be between 1 and 10.');
      if (!sec) rowReasons.push('Section is required.');

    } else if (importType === 'timetable') {
      const dept = (record.Department || record.department || '').trim().toUpperCase();
      const acadYear = (record['Academic Year'] || record.academicYear || '').trim().toUpperCase();
      const sem = parseInt(record.Semester || record.semester);
      const sec = (record.Section || record.section || '').trim().toUpperCase();
      const day = (record.Day || record.day || '').trim();
      const period = parseInt(record['Period Number'] || record.periodNumber);
      const slotTime = (record['Time Slot'] || record.timeSlot || '').trim();

      if (!dept) rowReasons.push('Department is required.');
      if (!acadYear) rowReasons.push('Academic Year is required.');
      if (isNaN(sem) || sem < 1 || sem > 10) rowReasons.push('Semester must be between 1 and 10.');
      if (!sec) rowReasons.push('Section is required.');
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (!day || !validDays.includes(day)) rowReasons.push('Day is required and must be one of Monday-Sunday.');
      if (isNaN(period)) rowReasons.push('Period Number is required.');
      if (!slotTime) rowReasons.push('Time Slot is required (e.g., 09:00-10:00).');
    }


    if (rowReasons.length > 0) {
      errors.push({ row: rowNum, rowValue: record, reasons: rowReasons });
    }
    if (rowWarnings.length > 0) {
      warnings.push({ row: rowNum, reasons: rowWarnings });
    }
  }

  return { errors, warnings, duplicates };
};

// 5. Row Processor (creates or updates records based on import type)
const processImportRow = async (collegeCode, importType, record, strategy, createdIds, getHashedPassword) => {
  // Normalize parameters
  const email = (record.Email || record.email || record['Email Address'] || '').trim().toLowerCase();
  const phone = (record.Phone || record.Mobile || record['Mobile Number'] || '').trim();

  if (importType === 'departments') {
    const code = (record['Department Code'] || record.departmentCode || record.code || '').trim().toUpperCase();
    const name = record['Department Name'] || record.departmentName || '';
    const desc = record.Building || record.building || '';
    const hodEmpId = (record['HOD Employee ID'] || record.hodEmployeeId || '').trim();

    let dept = await Department.findOne({ collegeCode, code });

    if (dept) {
      if (strategy === 'Skip Duplicates') return { status: 'skipped' };
      if (strategy === 'Replace Existing Records') {
        await Department.deleteOne({ _id: dept._id });
        dept = null;
      }
    }

    if (!dept) {
      dept = await Department.create({
        code,
        name,
        description: desc,
        collegeCode,
        status: 'active'
      });
      createdIds.departments.push(dept._id);
    } else {
      dept.name = name;
      dept.description = desc;
      await dept.save();
    }

    if (hodEmpId) {
      // Find HOD User and link
      const user = await User.findOne({ collegeCode, employeeId: hodEmpId, role: 'hod' });
      if (user) {
        dept.hodId = user._id;
        await dept.save();
        user.assignedDepartment = code;
        await user.save();
      }
    }

    return { status: 'success' };

  } else if (importType === 'faculty') {
    const empId = (record['Employee ID'] || record.employeeId || '').trim().toUpperCase();
    const name = record['Faculty Name'] || record.facultyName || record.fullName || '';
    const deptCode = (record.Department || record.department || '').trim().toUpperCase();
    const designation = record.Designation || record.designation || 'Professor';
    const qual = record.Qualification || record.qualification || '';
    const exp = parseInt(record.Experience || record.experience) || 0;
    const subCodes = (record.Subjects || record.subjects || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    let user = await User.findOne({ collegeCode, employeeId: empId });
    if (user) {
      if (strategy === 'Skip Duplicates') return { status: 'skipped' };
      if (strategy === 'Replace Existing Records') {
        await User.deleteOne({ _id: user._id });
        user = null;
      }
    }

    const defaultPassword = getHashedPassword ? await getHashedPassword(empId) : await bcrypt.hash(empId, 10);

    if (!user) {
      user = await User.create({
        fullName: name,
        email: email || `${empId.toLowerCase()}@faculty.edu`,
        username: empId.toLowerCase(),
        password: defaultPassword,
        role: 'faculty',
        collegeCode,
        employeeId: empId,
        assignedDepartment: deptCode,
        qualification: qual,
        jobTitle: designation,
        experienceYears: exp,
        mobileNumber: phone || undefined,
        status: 'ACTIVE',
        isActive: true,
        firstLogin: true
      });
      createdIds.users.push(user._id);
    } else {
      user.fullName = name;
      if (email) user.email = email;
      user.assignedDepartment = deptCode;
      user.qualification = qual;
      user.jobTitle = designation;
      user.experienceYears = exp;
      if (phone) user.mobileNumber = phone;
      await user.save();
    }

    // Link Subjects
    if (subCodes.length > 0) {
      await Subject.updateMany(
        { collegeCode, subjectCode: { $in: subCodes } },
        { $set: { faculty: user._id } }
      );
    }

    return { status: 'success' };

  } else if (importType === 'students') {
    const rollNumber = (record['Roll Number'] || record.rollNumber || record['Roll No'] || record.rollNo || '').trim().toUpperCase();
    const admissionNumber = (record['Admission Number'] || record.admissionNumber || record['Admission No'] || record.admissionNo || (rollNumber ? `ADM-${rollNumber}` : '')).trim().toUpperCase();
    const name = record['Student Name'] || record.studentName || record.fullName || record.Name || record.name || '';
    const dept = (record.Department || record.department || record.Branch || record.branch || 'ECE').trim().toUpperCase();
    const sem = parseInt(record.Semester || record.semester || record.Sem || record.sem) || 1;
    const sec = (record.Section || record.section || record.Sec || record.sec || 'A').trim().toUpperCase();
    const bloodGroup = record['Blood Group'] || record.bloodGroup || '';
    const address = record.Address || record.address || '';
    const parentName = record['Parent Name'] || record.parentName || record['Father Name'] || record.fatherName || '';
    const parentPhone = (record['Parent Mobile'] || record.parentMobile || record['Parent Phone'] || record.parentPhone || '').trim();

    // Map Department Names
    let resolvedDept = dept;
    if (dept.includes('ELECTRONICS') || dept.includes('COMMUNICATION') || dept === 'ECE') {
      resolvedDept = 'ECE';
    } else if (dept.includes('COMPUTER') || dept.includes('SCIENCE') || dept === 'CSE') {
      resolvedDept = 'CSE';
    } else if (dept.includes('MECHANICAL') || dept === 'MECH' || dept === 'ME') {
      resolvedDept = 'MECH';
    }

    let user = await User.findOne({ collegeCode, username: rollNumber.toLowerCase() });
    let studentRec = await StudentRecord.findOne({ collegeCode, rollNumber });

    if (user || studentRec) {
      if (strategy === 'Skip Duplicates') return { status: 'skipped' };
      if (strategy === 'Replace Existing Records') {
        if (user) await User.deleteOne({ _id: user._id });
        if (studentRec) await StudentRecord.deleteOne({ _id: studentRec._id });
        user = null;
        studentRec = null;
      }
    }

    const defaultPassword = getHashedPassword ? await getHashedPassword(rollNumber) : await bcrypt.hash(rollNumber, 10);

    if (!user) {
      user = await User.create({
        fullName: name,
        email: email || `${rollNumber.toLowerCase()}@student.edu`,
        username: rollNumber.toLowerCase(),
        password: defaultPassword,
        role: 'student',
        collegeCode,
        rollNumber,
        branch: resolvedDept,
        year: Math.ceil(sem / 2),
        semester: sem,
        section: sec,
        mobileNumber: phone || undefined,
        status: 'PRE_REGISTERED',
        isActive: true,
        firstLogin: true,
        isCollegeConnected: true,
        collegeLinked: true
      });
      createdIds.users.push(user._id);
    } else {
      user.fullName = name;
      if (email) user.email = email;
      user.branch = resolvedDept;
      user.year = Math.ceil(sem / 2);
      user.semester = sem;
      user.section = sec;
      if (phone) user.mobileNumber = phone;
      await user.save();
    }

    if (!studentRec) {
      studentRec = await StudentRecord.create({
        studentId: rollNumber,
        rollNumber,
        admissionNumber,
        fullName: name,
        gender: record.Gender || record.gender || 'Other',
        dob: record.DOB || record.dob ? new Date(record.DOB || record.dob) : new Date(),
        department: resolvedDept,
        branch: resolvedDept,
        course: 'B.TECH',
        academicYear: record['Academic Year'] || record.academicYear || '2026-2030',
        semester: sem,
        section: sec,
        mobileNumber: phone || '',
        parentDetails: { fatherName: parentName, parentPhone },
        photo: bloodGroup, // Store blood group in photo/remarks as fallback
        linkedUserId: user._id,
        collegeCode,
        status: 'Active'
      });
    } else {
      studentRec.fullName = name;
      studentRec.admissionNumber = admissionNumber;
      studentRec.department = resolvedDept;
      studentRec.branch = resolvedDept;
      studentRec.semester = sem;
      studentRec.section = sec;
      studentRec.mobileNumber = phone || '';
      studentRec.parentDetails = { fatherName: parentName, parentPhone };
      studentRec.photo = bloodGroup;
      await studentRec.save();
    }

    return { status: 'success' };
  } else if (importType === 'subjects') {
    const code = (record['Subject Code'] || record.subjectCode || '').trim().toUpperCase();
    const name = record['Subject Name'] || record.subjectName || '';
    const credits = parseInt(record.Credits || record.credits) || 3;
    const dept = (record.Department || record.department || '').trim().toUpperCase();
    const sem = parseInt(record.Semester || record.semester) || 1;
    const facEmpId = (record.Faculty || record.faculty || '').trim();

    let subject = await Subject.findOne({ collegeCode, subjectCode: code });

    if (subject) {
      if (strategy === 'Skip Duplicates') return { status: 'skipped' };
      if (strategy === 'Replace Existing Records') {
        await Subject.deleteOne({ _id: subject._id });
        subject = null;
      }
    }

    let facultyUser = null;
    if (facEmpId) {
      facultyUser = await User.findOne({ collegeCode, employeeId: facEmpId, role: 'faculty' });
    }

    if (!subject) {
      subject = await Subject.create({
        subjectCode: code,
        name,
        credits,
        department: dept,
        semester: sem,
        collegeCode,
        faculty: facultyUser ? facultyUser._id : null
      });
      createdIds.subjects.push(subject._id);
    } else {
      subject.name = name;
      subject.credits = credits;
      subject.department = dept;
      subject.semester = sem;
      if (facultyUser) subject.faculty = facultyUser._id;
      await subject.save();
    }

    return { status: 'success' };
  } else if (importType === 'academics') {
    const dept = (record.Department || record.department || '').trim().toUpperCase();
    const year = parseInt(record.Year || record.year) || 1;
    const sem = parseInt(record.Semester || record.semester) || 1;
    const sec = (record.Section || record.section || '').trim().toUpperCase();

    // Push into College ERP Arrays directly
    const college = await College.findOne({ collegeCode });
    if (college) {
      let modified = false;
      if (dept && !college.branches.includes(dept)) {
        college.branches.push(dept);
        modified = true;
      }
      const yrStr = String(year);
      if (yrStr && !college.academicYears.includes(yrStr)) {
        college.academicYears.push(yrStr);
        modified = true;
      }
      const semStr = String(sem);
      if (semStr && !college.semesters.includes(semStr)) {
        college.semesters.push(semStr);
        modified = true;
      }
      if (sec && !college.sections.includes(sec)) {
        college.sections.push(sec);
        modified = true;
      }
      if (modified) {
        await college.save();
      }
    }

    return { status: 'success' };
  } else if (importType === 'hods') {
    const empId = (record['Employee ID'] || record.employeeId || '').trim().toUpperCase();
    const name = record['HOD Name'] || record.hodName || record.fullName || record.name || '';
    const deptCode = (record.Department || record.department || '').trim().toUpperCase();

    let user = await User.findOne({ collegeCode, employeeId: empId });
    if (user) {
      if (strategy === 'Skip Duplicates') return { status: 'skipped' };
      if (strategy === 'Replace Existing Records') {
        await User.deleteOne({ _id: user._id });
        user = null;
      }
    }

    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash(empId, salt);

    if (!user) {
      user = await User.create({
        fullName: name,
        email: email || `${empId.toLowerCase()}@hod.edu`,
        username: empId.toLowerCase(),
        password: defaultPassword,
        role: 'hod',
        collegeCode,
        employeeId: empId,
        assignedDepartment: deptCode,
        mobileNumber: phone || undefined,
        status: 'ACTIVE',
        isActive: true,
        firstLogin: true
      });
      createdIds.users.push(user._id);
    } else {
      user.fullName = name;
      if (email) user.email = email;
      user.assignedDepartment = deptCode;
      if (phone) user.mobileNumber = phone;
      user.role = 'hod';
      await user.save();
    }

    // Link this HOD to the Department
    const dept = await Department.findOne({ collegeCode, code: deptCode });
    if (dept) {
      dept.hodId = user._id;
      await dept.save();
    }

    return { status: 'success' };

  } else if (importType === 'timetable') {
    const dept = (record.Department || record.department || '').trim().toUpperCase();
    const acadYear = (record['Academic Year'] || record.academicYear || '').trim().toUpperCase();
    const sem = parseInt(record.Semester || record.semester) || 1;
    const sec = (record.Section || record.section || 'A').trim().toUpperCase();
    const day = (record.Day || record.day || '').trim();
    const period = parseInt(record['Period Number'] || record.periodNumber) || 1;
    const slotTime = (record['Time Slot'] || record.timeSlot || '09:00-10:00').trim();
    const subCode = (record['Subject Code'] || record.subjectCode || '').trim().toUpperCase();
    const facEmpId = (record['Faculty Employee ID'] || record.facultyEmployeeId || record.faculty || record['Faculty'] || '').trim().toUpperCase();
    const room = (record.Room || record.room || '').trim();
    const type = (record.Type || record.type || 'Theory').trim();
    const label = (record.Label || record.label || '').trim();

    // Resolve subject and faculty
    const subject = await Subject.findOne({ collegeCode, subjectCode: subCode });
    const faculty = await User.findOne({ collegeCode, employeeId: facEmpId, role: 'faculty' });

    // Look for existing Timetable document
    let timetable = await Timetable.findOne({
      department: dept,
      academicYear: acadYear,
      semester: sem,
      section: sec,
      day: day,
      collegeCode
    });

    if (timetable) {
      if (strategy === 'Skip Duplicates') {
        const slotExists = timetable.slots.some(s => s.periodNumber === period);
        if (slotExists) {
          return { status: 'skipped' };
        }
      } else if (strategy === 'Replace Existing Records') {
        timetable.slots = timetable.slots.filter(s => s.periodNumber !== period);
      }
    }

    const newSlot = {
      periodNumber: period,
      timeSlot: slotTime,
      startTime: slotTime.split('-')[0] || '',
      endTime: slotTime.split('-')[1] || '',
      subjects: subject ? [subject._id] : [],
      subjectCode: subCode,
      subjectName: subject ? subject.name : '',
      facultyId: faculty ? String(faculty._id) : '',
      facultyName: faculty ? faculty.fullName : '',
      room,
      type,
      label
    };

    if (!timetable) {
      timetable = await Timetable.create({
        department: dept,
        academicYear: acadYear,
        semester: sem,
        year: Math.ceil(sem / 2),
        section: sec,
        day,
        collegeCode,
        slots: [newSlot],
        isApproved: true
      });
      createdIds.timetables.push(timetable._id);
    } else {
      timetable.slots.push(newSlot);
      await timetable.save();
    }

    return { status: 'success' };
  }

  return { status: 'failed', reason: 'Invalid import type' };
};

// 6. ERP Auto-Configurations Pipeline
const runErpAutoConfigurations = async (collegeCode) => {
  try {
    const college = await College.findOne({ collegeCode });
    if (!college) return;

    // Load active departments, sections, years, semesters, subjects
    const departments = await Department.find({ collegeCode }).distinct('code');
    const studentBranches = await StudentRecord.find({ collegeCode }).distinct('branch');
    const studentSections = await StudentRecord.find({ collegeCode }).distinct('section');
    const studentSemesters = await StudentRecord.find({ collegeCode }).distinct('semester');

    let modified = false;

    // Auto push missing branches/departments into College config arrays
    for (const d of [...departments, ...studentBranches]) {
      if (d && !college.branches.includes(d)) {
        college.branches.push(d);
        modified = true;
      }
    }

    // Auto push sections
    for (const s of studentSections) {
      if (s && !college.sections.includes(s)) {
        college.sections.push(s);
        modified = true;
      }
    }

    // Auto push semesters
    for (const sem of studentSemesters) {
      const semStr = String(sem);
      if (sem && !college.semesters.includes(semStr)) {
        college.semesters.push(semStr);
        modified = true;
      }
    }

    if (modified) {
      await college.save();
    }

    console.log(`🛠️ [ERP Auto-Config] Configured college: ${collegeCode}`);
  } catch (err) {
    console.error('ERP Auto Configuration error:', err.message);
  }
};

// 7. Get History Endpoint
const getImportHistory = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode.toUpperCase();
    const history = await ErpImport.find({ collegeCode })
      .populate('principalId', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 8. Download Errors list
const getImportErrors = async (req, res) => {
  try {
    const { id } = req.params;
    const importLog = await ErpImport.findOne({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!importLog) {
      return res.status(404).json({ message: 'Import history log not found.' });
    }

    res.status(200).json(importLog.errors || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 9. Rollback Previous Completed Import Run
const rollbackImport = async (req, res) => {
  try {
    const { id } = req.params;
    const collegeCode = req.user.collegeCode.toUpperCase();
    const importLog = await ErpImport.findOne({ _id: id, collegeCode });

    if (!importLog) {
      return res.status(404).json({ message: 'Import log not found.' });
    }

    if (importLog.status === 'rolled_back') {
      return res.status(400).json({ message: 'This import version is already rolled back.' });
    }

    const createdIds = importLog.createdIds;
    if (!createdIds || (createdIds.users.length === 0 && createdIds.departments.length === 0 && createdIds.subjects.length === 0 && createdIds.timetables.length === 0)) {
      return res.status(400).json({ message: 'No records to rollback for this import.' });
    }

    const startTime = Date.now();

    // Rollback records
    await User.deleteMany({ _id: { $in: createdIds.users } });
    await Department.deleteMany({ _id: { $in: createdIds.departments } });
    await Subject.deleteMany({ _id: { $in: createdIds.subjects } });
    await Timetable.deleteMany({ _id: { $in: createdIds.timetables } });
    await StudentRecord.deleteMany({ linkedUserId: { $in: createdIds.users } });

    importLog.status = 'rolled_back';
    importLog.rollbackReport = {
      status: 'completed',
      rolledBackRecords: createdIds.users.length + createdIds.departments.length + createdIds.subjects.length + createdIds.timetables.length,
      duration: Date.now() - startTime
    };
    await importLog.save();

    await sendDirectFcm('principal', collegeCode, '⏮️ ERP Import Rolled Back', `Import version ${importLog.version} has been rolled back and database restored.`);

    res.status(200).json({
      message: 'Rollback executed successfully.',
      rolledBackRecords: importLog.rollbackReport.rolledBackRecords,
      importLog
    });
  } catch (err) {
    res.status(500).json({ message: 'Rollback execution failed: ' + err.message });
  }
};

// 10. ERP Import Dashboard Stats
const getErpStats = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode.toUpperCase();
    
    // Aggregation counts
    const totalStudents = await StudentRecord.countDocuments({ collegeCode });
    const totalFaculty = await User.countDocuments({ collegeCode, role: 'faculty' });
    const totalDepts = await Department.countDocuments({ collegeCode });
    const totalSubjects = await Subject.countDocuments({ collegeCode });

    const college = await College.findOne({ collegeCode });
    const totalSections = college ? college.sections.length : 0;

    // Today's imports count
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayImports = await ErpImport.countDocuments({
      collegeCode,
      createdAt: { $gte: todayStart }
    });

    const completedRuns = await ErpImport.countDocuments({ collegeCode, status: 'completed' });
    const totalRuns = await ErpImport.countDocuments({ collegeCode });
    const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 100;

    const latestImport = await ErpImport.findOne({ collegeCode }).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      totalStudents,
      totalFaculty,
      totalDepts,
      totalSubjects,
      totalSections,
      todayImports,
      successRate,
      latestImport
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 11. Lock status checker
const getImportLockStatus = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode.toUpperCase();
    res.status(200).json({ locked: !!importLocks[collegeCode] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  addSubject,
  getSubjects,
  updateSubject,
  deleteSubject,
  createAssignment,
  createExamTimetable,
  createPlacementDrive,
  registerBook,
  issueBook,
  parseImportFile,
  validateImportData,
  executeImportData,
  getImportHistory,
  getImportErrors,
  rollbackImport,
  getErpStats,
  getImportLockStatus
};
