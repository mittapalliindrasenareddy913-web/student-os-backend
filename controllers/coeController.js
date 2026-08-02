const User = require('../models/User');
const Exam = require('../models/Exam');
const ExamSchedule = require('../models/ExamSchedule');
const HallTicket = require('../models/HallTicket');
const ExamResult = require('../models/ExamResult');
const Malpractice = require('../models/Malpractice');
const InvigilationDuty = require('../models/InvigilationDuty');
const RevaluationRequest = require('../models/RevaluationRequest');
const SeatingArrangement = require('../models/SeatingArrangement');
const ExamAttendance = require('../models/ExamAttendance');
const ExamMark = require('../models/ExamMark');
const AuditLog = require('../models/AuditLog');
const { logAction } = require('../services/auditLogService');
const { sendFcmNotification } = require('../services/notificationService');

// Socket notification helper
const notifySocket = (req, event, data) => {
  try {
    const io = req.app.get('socketio');
    if (io) {
      io.to(req.user.collegeCode).emit(event, data);
    }
  } catch (err) {
    console.error('Socket notification error:', err.message);
  }
};

// Helper: Calculate SGPA/CGPA Grade from marks (out of 100)
const marksToGradePoints = (marks) => {
  if (marks >= 90) return { grade: 'O', points: 10 };
  if (marks >= 80) return { grade: 'A+', points: 9 };
  if (marks >= 70) return { grade: 'A', points: 8 };
  if (marks >= 60) return { grade: 'B+', points: 7 };
  if (marks >= 50) return { grade: 'B', points: 6 };
  if (marks >= 40) return { grade: 'C', points: 5 };
  return { grade: 'F', points: 0 };
};

// =============================================================
// 1. DASHBOARD STATS & ANALYTICS
// =============================================================
const getDashboardStats = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode;

    const upcomingExams = await ExamSchedule.countDocuments({ collegeCode, examDate: { $gte: new Date() } });
    const hallTicketsPending = await HallTicket.countDocuments({ collegeCode, status: { $ne: 'published' } });
    const resultsPending = await ExamResult.countDocuments({ collegeCode, status: { $ne: 'published' } });
    const revaluationRequests = await RevaluationRequest.countDocuments({ collegeCode, type: 'revaluation', status: 'pending' });
    const supplementaryApplications = await RevaluationRequest.countDocuments({ collegeCode, type: 'supplementary', status: 'pending' });
    
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    const endOfToday = new Date();
    endOfToday.setHours(23,59,59,999);
    const todayExamSchedules = await ExamSchedule.countDocuments({ collegeCode, examDate: { $gte: startOfToday, $lte: endOfToday } });

    res.status(200).json({
      upcomingExams,
      hallTicketsPending,
      resultsPending,
      revaluationRequests,
      supplementaryApplications,
      todayExamSchedules
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 2. EXAMINATION MANAGEMENT
// =============================================================
const createExam = async (req, res) => {
  try {
    const { title, type, examType, regulation, semester, startDate } = req.body;
    const collegeCode = req.user.collegeCode;

    if (!title || !semester || !startDate) {
      return res.status(400).json({ message: 'Title, semester, and start date are required.' });
    }

    const exam = await Exam.create({
      title,
      type: type || 'external',
      examType: examType || 'external',
      regulation: regulation || 'R22',
      semester: Number(semester),
      startDate: new Date(startDate),
      status: 'draft',
      published: false,
      collegeCode
    });

    await logAction(req.user._id, 'coe', collegeCode, '', `CREATED_EXAM: ${title}`, req, null, exam.toObject());
    res.status(201).json({ message: 'Exam configuration created.', exam });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getExams = async (req, res) => {
  try {
    const list = await Exam.find({ collegeCode: req.user.collegeCode }).sort({ startDate: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const collegeCode = req.user.collegeCode;
    const oldExam = await Exam.findOne({ _id: id, collegeCode });
    if (!oldExam) return res.status(404).json({ message: 'Exam not found.' });

    const newExam = await Exam.findByIdAndUpdate(id, req.body, { new: true });
    await logAction(req.user._id, 'coe', collegeCode, '', `UPDATED_EXAM: ${oldExam.title}`, req, oldExam.toObject(), newExam.toObject());
    res.status(200).json({ message: 'Exam configuration updated.', exam: newExam });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    const collegeCode = req.user.collegeCode;
    const exam = await Exam.findOne({ _id: id, collegeCode });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });

    await Exam.findByIdAndDelete(id);
    await logAction(req.user._id, 'coe', collegeCode, '', `DELETED_EXAM: ${exam.title}`, req, exam.toObject(), null);
    res.status(200).json({ message: 'Exam deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const publishExam = async (req, res) => {
  try {
    const { id } = req.params;
    const collegeCode = req.user.collegeCode;
    const oldExam = await Exam.findOne({ _id: id, collegeCode });
    if (!oldExam) return res.status(404).json({ message: 'Exam not found.' });

    const newExam = await Exam.findByIdAndUpdate(id, { status: 'published', published: true }, { new: true });
    await logAction(req.user._id, 'coe', collegeCode, '', `PUBLISHED_EXAM: ${oldExam.title}`, req, oldExam.toObject(), newExam.toObject());
    res.status(200).json({ message: 'Exam published.', exam: newExam });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 3. EXAMINATION TIMETABLE (ExamSchedule)
// =============================================================
const createSchedule = async (req, res) => {
  try {
    const { department, semester, section, subjectName, subjectCode, examDate, timeSlot, startTime, endTime, room, type } = req.body;
    const collegeCode = req.user.collegeCode;

    if (!subjectCode || !examDate || !timeSlot || !room || !semester) {
      return res.status(400).json({ message: 'Missing schedule fields.' });
    }

    const schedule = await ExamSchedule.create({
      department: department || '',
      semester: Number(semester),
      section: section || 'A',
      subjectName: subjectName || '',
      subjectCode: subjectCode.toUpperCase(),
      examDate: new Date(examDate),
      timeSlot,
      startTime: startTime || '09:30',
      endTime: endTime || '12:30',
      room,
      type: type || 'semester',
      collegeCode
    });

    await logAction(req.user._id, 'coe', collegeCode, '', `ADDED_EXAM_SCHEDULE: ${subjectCode.toUpperCase()}`, req, null, schedule.toObject());
    res.status(201).json({ message: 'Timetable slot created.', schedule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getExamSchedules = async (req, res) => {
  try {
    const list = await ExamSchedule.find({ collegeCode: req.user.collegeCode }).sort({ examDate: 1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const collegeCode = req.user.collegeCode;
    const oldSched = await ExamSchedule.findOne({ _id: id, collegeCode });
    if (!oldSched) return res.status(404).json({ message: 'Schedule not found.' });

    const newSched = await ExamSchedule.findByIdAndUpdate(id, req.body, { new: true });
    await logAction(req.user._id, 'coe', collegeCode, '', `UPDATED_EXAM_SCHEDULE: ${oldSched.subjectCode}`, req, oldSched.toObject(), newSched.toObject());
    res.status(200).json({ message: 'Schedule slot updated.', schedule: newSched });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const collegeCode = req.user.collegeCode;
    const sched = await ExamSchedule.findOne({ _id: id, collegeCode });
    if (!sched) return res.status(404).json({ message: 'Schedule not found.' });

    await ExamSchedule.findByIdAndDelete(id);
    await logAction(req.user._id, 'coe', collegeCode, '', `DELETED_EXAM_SCHEDULE: ${sched.subjectCode}`, req, sched.toObject(), null);
    res.status(200).json({ message: 'Schedule slot deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const publishTimetable = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode;
    
    // Broadcast notification
    await sendFcmNotification({
      collegeCode,
      title: '📅 Examination Timetable Published',
      body: 'The latest exam dates and room mappings have been published.'
    });

    notifySocket(req, 'exam_timetable_published', { timestamp: new Date() });
    await logAction(req.user._id, 'coe', collegeCode, '', 'PUBLISHED_MASTER_TIMETABLE', req);
    res.status(200).json({ message: 'Exam timetable published to Student OS.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 4. HALL TICKET MANAGEMENT (Draft -> Preview -> Approve -> Publish)
// =============================================================
const getHallTickets = async (req, res) => {
  try {
    const list = await HallTicket.find({ collegeCode: req.user.collegeCode })
      .populate('studentId', 'fullName rollNumber branch year semester')
      .sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const generateBulkHallTickets = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode;
    const students = await User.find({ collegeCode, role: 'student' });
    const generated = [];

    for (const stud of students) {
      // 1. Eligibility verification
      const presentCount = (stud.attendanceLogs || []).filter((l) => l.status === 'Present').length;
      const totalLogs = (stud.attendanceLogs || []).length;
      const attendancePct = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 85; // Fallback to 85 if empty
      
      const isAttEligible = attendancePct >= 75;
      const rollNumber = stud.rollNumber || `SOS-${stud._id.toString().substring(18)}`;
      
      // Determine other eligibility flags
      const isDetained = false; // Detained logic placeholder
      const feeStatus = 'Paid'; // Fee ledger placeholder
      const isInternalEligible = true; // Minimum internal marks check
      
      const isEligible = isAttEligible && !isDetained && feeStatus === 'Paid' && isInternalEligible;

      // Map subjects and dates scheduled for student's semester
      const schedules = await ExamSchedule.find({ collegeCode, semester: stud.semester });
      const subjects = schedules.map(s => s.subjectCode);
      const examDates = schedules.map(s => s.examDate);

      // Create/Update ticket in 'draft'
      let ht = await HallTicket.findOne({ studentId: stud._id, collegeCode });
      const ticketData = {
        studentId: stud._id,
        rollNumber,
        qrCodeData: `VERIFIED-HT:${rollNumber}:${collegeCode}:${stud.semester}`,
        status: 'draft',
        eligibilityVerified: isEligible,
        attendancePct,
        internalMarksStatus: isInternalEligible ? 'Eligible' : 'Ineligible',
        feeStatus,
        detainedStatus: isDetained,
        subjects,
        examDates,
        collegeCode
      };

      if (ht) {
        ht = await HallTicket.findByIdAndUpdate(ht._id, ticketData, { new: true });
      } else {
        ht = await HallTicket.create(ticketData);
      }
      generated.push(ht);
    }

    await logAction(req.user._id, 'coe', collegeCode, '', 'GENERATED_BULK_HALL_TICKETS_DRAFTS', req);
    res.status(201).json({ message: `${generated.length} hall ticket drafts generated.`, tickets: generated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateHallTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'preview', 'approved', 'published'
    const collegeCode = req.user.collegeCode;

    const oldTicket = await HallTicket.findOne({ _id: id, collegeCode });
    if (!oldTicket) return res.status(404).json({ message: 'Hall Ticket not found.' });

    const newTicket = await HallTicket.findByIdAndUpdate(id, { status }, { new: true });
    
    // If published, trigger notifications
    if (status === 'published') {
      await sendFcmNotification({
        collegeCode,
        title: '🎟️ Hall Tickets Published!',
        body: `Hall ticket for roll number ${oldTicket.rollNumber} is available for download.`
      });
      notifySocket(req, 'hall_tickets_generated', { rollNumber: oldTicket.rollNumber });
    }

    await logAction(req.user._id, 'coe', collegeCode, '', `UPDATED_HALL_TICKET_STATUS: ${oldTicket.rollNumber} to ${status}`, req, oldTicket.toObject(), newTicket.toObject());
    res.status(200).json({ message: `Hall ticket updated to ${status}.`, ticket: newTicket });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 5. SEATING ARRANGEMENT
// =============================================================
const allocateSeating = async (req, res) => {
  try {
    const { examScheduleId, room, studentsList } = req.body; // studentsList: array of student objects with studentId/rollNumber
    const collegeCode = req.user.collegeCode;

    if (!examScheduleId || !room || !studentsList || studentsList.length === 0) {
      return res.status(400).json({ message: 'Exam schedule ID, room, and students are required.' });
    }

    // Auto seating algorithm: assign bench numbers and seat positions
    const arrangements = studentsList.map((st, idx) => {
      const bench = Math.ceil((idx + 1) / 2);
      const seat = (idx % 2 === 0) ? 'L' : 'R'; // Left or Right seat on bench
      return {
        studentId: st.studentId,
        rollNumber: st.rollNumber,
        benchNumber: `B-${bench}`,
        seatNumber: `Seat-${bench}${seat}`
      };
    });

    // Delete existing arrangement for this schedule-room if any, and overwrite
    await SeatingArrangement.deleteMany({ examScheduleId, room, collegeCode });

    const seating = await SeatingArrangement.create({
      examScheduleId,
      room,
      arrangements,
      collegeCode
    });

    await logAction(req.user._id, 'coe', collegeCode, '', `ALLOCATED_SEATING: Room ${room} for schedule ${examScheduleId}`, req, null, seating.toObject());
    res.status(201).json({ message: 'Seating arrangement generated.', seating });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSeatingArrangements = async (req, res) => {
  try {
    const list = await SeatingArrangement.find({ collegeCode: req.user.collegeCode })
      .populate('examScheduleId')
      .populate('arrangements.studentId', 'fullName rollNumber');
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 6. INVIGILATION DUTY MANAGEMENT
// =============================================================
const assignInvigilation = async (req, res) => {
  try {
    const { facultyId, examScheduleId, room, date, time } = req.body;
    const collegeCode = req.user.collegeCode;

    if (!facultyId || !examScheduleId || !room || !date || !time) {
      return res.status(400).json({ message: 'All invigilation duty fields are required.' });
    }

    const duty = await InvigilationDuty.create({
      facultyId,
      examScheduleId,
      room,
      date: new Date(date),
      time,
      status: 'assigned',
      collegeCode
    });

    // Notify faculty via socket and FCM
    const fac = await User.findById(facultyId);
    if (fac) {
      await sendFcmNotification({
        collegeCode,
        title: '👮 Invigilation Duty Assigned',
        body: `Dear ${fac.fullName}, you have been assigned to invigilate Room ${room} on ${new Date(date).toLocaleDateString()}.`
      });
      notifySocket(req, 'invigilation_assigned', { facultyId, room, date });
    }

    await logAction(req.user._id, 'coe', collegeCode, '', `ASSIGNED_INVIGILATION: Faculty ${facultyId} to Room ${room}`, req, null, duty.toObject());
    res.status(201).json({ message: 'Invigilation duty assigned.', duty });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getInvigilationDuties = async (req, res) => {
  try {
    const list = await InvigilationDuty.find({ collegeCode: req.user.collegeCode })
      .populate('facultyId', 'fullName employeeId')
      .populate('examScheduleId');
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 7. INTERNAL MARKS VERIFICATION (Approve/Reject/Discrepancy)
// =============================================================
const getInternalMarks = async (req, res) => {
  try {
    const list = await ExamMark.find({ collegeCode: req.user.collegeCode })
      .populate('studentId', 'fullName rollNumber branch year')
      .sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const verifyInternalMark = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'
    const collegeCode = req.user.collegeCode;

    const oldMark = await ExamMark.findOne({ _id: id, collegeCode });
    if (!oldMark) return res.status(404).json({ message: 'Mark entry not found.' });

    const newMark = await ExamMark.findByIdAndUpdate(id, { status }, { new: true });
    await logAction(req.user._id, 'coe', collegeCode, '', `VERIFIED_INTERNAL_MARK: Student ${oldMark.studentId} subject ${oldMark.subjectCode} to ${status}`, req, oldMark.toObject(), newMark.toObject());
    res.status(200).json({ message: `Internal mark entry ${status}.`, mark: newMark });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getInternalDiscrepancyReport = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode;
    // Find internal marks with status 'rejected' or marks that fall below 40% (potential failing)
    const discrepancies = await ExamMark.find({
      collegeCode,
      $or: [
        { status: 'rejected' },
        { marks: { $lt: 40 } } // Discrepancy warning threshold
      ]
    }).populate('studentId', 'fullName rollNumber branch');

    res.status(200).json(discrepancies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 8. EXTERNAL MARKS MANAGEMENT
// =============================================================
const uploadExternalMarks = async (req, res) => {
  try {
    const { studentId, subjectCode, marks, maxMarks } = req.body;
    const collegeCode = req.user.collegeCode;

    if (!studentId || !subjectCode || marks === undefined) {
      return res.status(400).json({ message: 'Missing external marks fields.' });
    }

    const mark = await ExamMark.create({
      studentId,
      subjectCode: subjectCode.toUpperCase(),
      marks: Number(marks),
      maxMarks: maxMarks || 100,
      type: 'external',
      status: 'approved', // COE uploaded directly
      collegeCode
    });

    await logAction(req.user._id, 'coe', collegeCode, '', `UPLOADED_EXTERNAL_MARK: Student ${studentId} subject ${subjectCode}`, req, null, mark.toObject());
    res.status(201).json({ message: 'External mark uploaded successfully.', mark });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkUploadExternalMarks = async (req, res) => {
  try {
    const { marksList } = req.body; // array of objects with rollNumber, subjectCode, marks, maxMarks
    const collegeCode = req.user.collegeCode;

    if (!marksList || marksList.length === 0) {
      return res.status(400).json({ message: 'Empty marks upload list.' });
    }

    const uploaded = [];
    for (const item of marksList) {
      const stud = await User.findOne({ rollNumber: item.rollNumber, collegeCode });
      if (!stud) continue;

      const mark = await ExamMark.create({
        studentId: stud._id,
        subjectCode: item.subjectCode.toUpperCase(),
        marks: Number(item.marks),
        maxMarks: item.maxMarks || 100,
        type: 'external',
        status: 'approved',
        collegeCode
      });
      uploaded.push(mark);
    }

    await logAction(req.user._id, 'coe', collegeCode, '', `BULK_UPLOADED_EXTERNAL_MARKS: Count ${uploaded.length}`, req);
    res.status(201).json({ message: `${uploaded.length} external marks registered.`, records: uploaded });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 9. RESULTS PROCESSING & MODERATION / GRACE MARKS
// =============================================================
const processSemesterResults = async (req, res) => {
  try {
    const { studentId, semester, graceMarksAdded, graceSubjectCode } = req.body;
    const collegeCode = req.user.collegeCode;

    if (!studentId || !semester) {
      return res.status(400).json({ message: 'Student ID and semester are required.' });
    }

    // 1. Fetch all internal and external marks for the student for this semester
    const internals = await ExamMark.find({ studentId, collegeCode, type: { $in: ['mid_1', 'mid_2'] } });
    const externals = await ExamMark.find({ studentId, collegeCode, type: 'external', status: 'approved' });

    // Group subjects
    const subjectMap = {};
    internals.forEach(m => {
      if (!subjectMap[m.subjectCode]) subjectMap[m.subjectCode] = { internals: [], external: 0 };
      subjectMap[m.subjectCode].internals.push(m.marks);
    });

    externals.forEach(m => {
      if (!subjectMap[m.subjectCode]) subjectMap[m.subjectCode] = { internals: [40, 40], external: 0 }; // default fake internals
      subjectMap[m.subjectCode].external = m.marks;
    });

    // Build subjectGrades and calculate SGPA
    const subjectGrades = [];
    let totalPoints = 0;
    let totalCredits = 0;
    let hasFailed = false;

    Object.keys(subjectMap).forEach(subCode => {
      const avgInternal = subjectMap[subCode].internals.length > 0 
        ? subjectMap[subCode].internals.reduce((a, b) => a + b, 0) / subjectMap[subCode].internals.length 
        : 25; // default avg internal out of 40

      let extScore = subjectMap[subCode].external;

      // Apply grace marks if configured
      if (graceMarksAdded && graceSubjectCode && subCode === graceSubjectCode.toUpperCase()) {
        extScore += Number(graceMarksAdded);
      }

      const totalMarks = Math.min(avgInternal + extScore, 100);
      const { grade, points } = marksToGradePoints(totalMarks);
      const credits = 4; // Flat subject credit mapping

      if (grade === 'F') hasFailed = true;

      subjectGrades.push({
        subjectCode: subCode,
        internalMarks: Math.round(avgInternal),
        externalMarks: Math.round(extScore),
        totalMarks: Math.round(totalMarks),
        grade,
        credits
      });

      totalPoints += (points * credits);
      totalCredits += credits;
    });

    const sgpa = totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(2)) : 0;
    const cgpa = sgpa; // Simplify: CGPA equals current semester SGPA for now

    // Overwrite existing preview result or create new
    let result = await ExamResult.findOne({ studentId, semester, collegeCode });
    const resultPayload = {
      studentId,
      semester: Number(semester),
      sgpa,
      cgpa,
      passStatus: hasFailed ? 'Fail' : 'Pass',
      status: 'preview',
      moderationApplied: !!graceMarksAdded,
      graceMarksAdded: graceMarksAdded ? Number(graceMarksAdded) : 0,
      graceSubjectCode: graceSubjectCode || '',
      subjectGrades,
      collegeCode
    };

    if (result) {
      result = await ExamResult.findByIdAndUpdate(result._id, resultPayload, { new: true });
    } else {
      result = await ExamResult.create(resultPayload);
    }

    await logAction(req.user._id, 'coe', collegeCode, '', `PROCESSED_SEMESTER_RESULTS: Student ${studentId} Sem ${semester}`, req, null, result.toObject());
    res.status(201).json({ message: 'Result computed and saved to preview mode.', result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// GET all exam results for the college (paginated)
const getExamResults = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode;
    const { studentId, semester, status, page = 1, limit = 50 } = req.query;
    const query = { collegeCode };
    if (studentId) query.studentId = studentId;
    if (semester)  query.semester  = Number(semester);
    if (status)    query.status    = status;

    const results = await ExamResult.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const total = await ExamResult.countDocuments(query);
    res.status(200).json({ results, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const publishExamResults = async (req, res) => {
  try {
    const { id } = req.params;
    const collegeCode = req.user.collegeCode;

    const oldRes = await ExamResult.findOne({ _id: id, collegeCode });
    if (!oldRes) return res.status(404).json({ message: 'Result draft not found.' });

    const newRes = await ExamResult.findByIdAndUpdate(id, { status: 'published' }, { new: true });
    
    // Notify student
    await sendFcmNotification({
      collegeCode,
      title: '🎉 Results Published!',
      body: `Grades for Semester ${oldRes.semester} have been released. Check your profile now.`
    });
    
    notifySocket(req, 'results_published', { studentId: oldRes.studentId, semester: oldRes.semester });
    await logAction(req.user._id, 'coe', collegeCode, '', `PUBLISHED_EXAM_RESULTS: Sem ${oldRes.semester} student ${oldRes.studentId}`, req, oldRes.toObject(), newRes.toObject());
    res.status(200).json({ message: 'Results published successfully.', result: newRes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 10. REVALUATION & SUPPLEMENTARY
// =============================================================
const applyRevaluation = async (req, res) => {
  try {
    const { studentId, subjectCode, semester, examType, type, amountPaid } = req.body;
    const collegeCode = req.user.collegeCode;

    if (!studentId || !subjectCode || !semester || !type) {
      return res.status(400).json({ message: 'Missing revaluation filing inputs.' });
    }

    const request = await RevaluationRequest.create({
      studentId,
      subjectCode: subjectCode.toUpperCase(),
      semester: Number(semester),
      examType: examType || 'semester',
      type,
      amountPaid: amountPaid ? Number(amountPaid) : 0,
      status: 'pending',
      collegeCode
    });

    res.status(201).json({ message: 'Application submitted successfully.', request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getRevaluationRequests = async (req, res) => {
  try {
    const list = await RevaluationRequest.find({ collegeCode: req.user.collegeCode })
      .populate('studentId', 'fullName rollNumber branch')
      .sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateRevaluationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body; // 'approved' or 'rejected'
    const collegeCode = req.user.collegeCode;

    const oldReq = await RevaluationRequest.findOne({ _id: id, collegeCode });
    if (!oldReq) return res.status(404).json({ message: 'Request not found.' });

    const newReq = await RevaluationRequest.findByIdAndUpdate(id, { status, remarks }, { new: true });
    
    // Log action
    await logAction(req.user._id, 'coe', collegeCode, '', `VERIFIED_REVALUATION_REQUEST: Student ${oldReq.studentId} status ${status}`, req, oldReq.toObject(), newReq.toObject());
    res.status(200).json({ message: `Request status updated to ${status}.`, request: newReq });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 11. MALPRACTICE CASES
// =============================================================
const updateMalpractice = async (req, res) => {
  try {
    const { id } = req.params;
    const collegeCode = req.user.collegeCode;
    const oldMp = await Malpractice.findOne({ _id: id, collegeCode });
    if (!oldMp) return res.status(404).json({ message: 'Malpractice case not found.' });

    const newMp = await Malpractice.findByIdAndUpdate(id, req.body, { new: true });
    await logAction(req.user._id, 'coe', collegeCode, '', `UPDATED_MALPRACTICE_CASE: ${oldMp.caseNumber || oldMp._id}`, req, oldMp.toObject(), newMp.toObject());
    res.status(200).json({ message: 'Malpractice case details modified.', malpractice: newMp });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteMalpractice = async (req, res) => {
  try {
    const { id } = req.params;
    const collegeCode = req.user.collegeCode;
    const mp = await Malpractice.findOne({ _id: id, collegeCode });
    if (!mp) return res.status(404).json({ message: 'Malpractice case not found.' });

    await Malpractice.findByIdAndDelete(id);
    await logAction(req.user._id, 'coe', collegeCode, '', `DELETED_MALPRACTICE_CASE: ${mp.caseNumber || mp._id}`, req, mp.toObject(), null);
    res.status(200).json({ message: 'Malpractice case deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 12. EXAM ATTENDANCE LOGGER
// =============================================================
const saveExamAttendance = async (req, res) => {
  try {
    const { studentId, examScheduleId, status, remarks } = req.body;
    const collegeCode = req.user.collegeCode;

    if (!studentId || !examScheduleId || !status) {
      return res.status(400).json({ message: 'Missing fields for exam attendance.' });
    }

    let att = await ExamAttendance.findOne({ studentId, examScheduleId, collegeCode });
    const payload = { studentId, examScheduleId, status, remarks, collegeCode };

    if (att) {
      att = await ExamAttendance.findByIdAndUpdate(att._id, payload, { new: true });
    } else {
      att = await ExamAttendance.create(payload);
    }

    res.status(200).json({ message: 'Exam attendance recorded.', attendance: att });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getExamAttendance = async (req, res) => {
  try {
    const list = await ExamAttendance.find({ collegeCode: req.user.collegeCode })
      .populate('studentId', 'fullName rollNumber branch')
      .populate('examScheduleId');
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 13. EXAMINATION NOTIFICATIONS
// =============================================================
const publishNotification = async (req, res) => {
  try {
    const { title, body, category } = req.body;
    const collegeCode = req.user.collegeCode;

    if (!title || !body) {
      return res.status(400).json({ message: 'Title and body are required.' });
    }

    // Trigger push notification to all students and faculty
    await sendFcmNotification({
      collegeCode,
      title: `📣 COE Alert: ${title}`,
      body
    });

    notifySocket(req, 'coe_notification', { title, body, category: category || 'general' });
    await logAction(req.user._id, 'coe', collegeCode, '', `PUBLISHED_COE_NOTIFICATION: ${title}`, req);
    res.status(201).json({ message: 'COE circular published.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 14. STUDENT SEARCH & ELIGIBILITY CONSOLE
// =============================================================
const searchStudentExams = async (req, res) => {
  try {
    const { query } = req.query; // rollNumber, name, etc.
    const collegeCode = req.user.collegeCode;

    if (!query) return res.status(400).json({ message: 'Query string is required.' });

    const stud = await User.findOne({
      collegeCode,
      role: 'student',
      $or: [
        { rollNumber: { $regex: query, $options: 'i' } },
        { fullName: { $regex: query, $options: 'i' } }
      ]
    });

    if (!stud) return res.status(404).json({ message: 'Student not found.' });

    // Retrieve hall ticket, results and backlogs
    const hallTicket = await HallTicket.findOne({ studentId: stud._id, collegeCode });
    const results = await ExamResult.find({ studentId: stud._id, collegeCode });
    
    // Backlogs calculated as failing grades ('F')
    const backlogs = [];
    results.forEach(r => {
      r.subjectGrades.forEach(sg => {
        if (sg.grade === 'F') backlogs.push({ subjectCode: sg.subjectCode, semester: r.semester });
      });
    });

    res.status(200).json({
      student: {
        _id: stud._id,
        fullName: stud.fullName,
        rollNumber: stud.rollNumber,
        branch: stud.branch,
        semester: stud.semester,
        email: stud.email
      },
      hallTicket,
      results,
      backlogs
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 15. AUDIT LOGS VIEW
// =============================================================
const getAuditLogs = async (req, res) => {
  try {
    const list = await AuditLog.find({ collegeCode: req.user.collegeCode })
      .populate('userId', 'fullName role')
      .sort({ timestamp: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 16. PROFILE EDITING
// =============================================================
const updateProfile = async (req, res) => {
  try {
    const { fullName, mobileNumber, newPassword } = req.body;
    const collegeCode = req.user.collegeCode;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'COE User not found.' });

    const oldData = user.toObject();

    if (fullName) user.fullName = fullName;
    if (mobileNumber) user.mobileNumber = mobileNumber;
    if (newPassword) {
      const bcrypt = require('bcryptjs');
      user.password = await bcrypt.hash(newPassword, 10);
    }

    const saved = await user.save();
    await logAction(req.user._id, 'coe', collegeCode, '', 'UPDATED_COE_PROFILE', req, oldData, saved.toObject());
    
    res.status(200).json({ message: 'Profile updated.', user: saved });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getDashboardStats,
  createExam,
  getExams,
  updateExam,
  deleteExam,
  publishExam,
  createSchedule,
  getExamSchedules,
  updateSchedule,
  deleteSchedule,
  publishTimetable,
  getHallTickets,
  generateBulkHallTickets,
  updateHallTicketStatus,
  allocateSeating,
  getSeatingArrangements,
  assignInvigilation,
  getInvigilationDuties,
  getInternalMarks,
  verifyInternalMark,
  getInternalDiscrepancyReport,
  uploadExternalMarks,
  bulkUploadExternalMarks,
  processSemesterResults,
  getExamResults,
  publishExamResults,
  applyRevaluation,
  getRevaluationRequests,
  updateRevaluationStatus,
  updateMalpractice,
  deleteMalpractice,
  saveExamAttendance,
  getExamAttendance,
  publishNotification,
  searchStudentExams,
  getAuditLogs,
  updateProfile
};
