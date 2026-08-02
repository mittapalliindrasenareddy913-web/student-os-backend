const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const ExamMark = require('../models/ExamMark');
const LeaveRequest = require('../models/LeaveRequest');
const Assignment = require('../models/Assignment');
const Material = require('../models/Material');
const LabRecord = require('../models/LabRecord');
const ClassDiary = require('../models/ClassDiary');
const Doubt = require('../models/Doubt');
const Notice = require('../models/Notice');
const Event = require('../models/Event');
const StudentRecord = require('../models/StudentRecord');
const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const bcrypt = require('bcryptjs');
const { logAction } = require('../services/auditLogService');
const { sendFcmNotification } = require('../services/notificationService');

// Helper to get current day name
const getTodayDayName = () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
};

// =============================================================
// 1. DASHBOARD STATS
// =============================================================
const getDashboardStats = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode.toUpperCase();
    const facultyId = req.user._id.toString();
    const dept = req.user.assignedDepartment || '';

    // Today's classes from Timetable
    const today = getTodayDayName();
    const timetables = await Timetable.find({
      collegeCode,
      day: today,
      'slots.facultyId': facultyId
    });

    let todayClasses = [];
    timetables.forEach(t => {
      t.slots.forEach(s => {
        if (s.facultyId === facultyId) {
          todayClasses.push({
            timeSlot: s.timeSlot,
            subjectCode: s.subjectCode,
            subjectName: s.subjectName,
            section: t.section,
            room: s.room || 'N/A'
          });
        }
      });
    });

    // Next class calculation
    let nextClassSlot = 'No more classes today';
    if (todayClasses.length > 0) {
      // Sort classes by start time (simple string comparison of time e.g., "09:00")
      todayClasses.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
      const now = new Date();
      const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const upcoming = todayClasses.find(c => {
        const parts = c.timeSlot.split('-');
        const startTime = parts[0].trim();
        return startTime > currentHourMin;
      });
      if (upcoming) {
        nextClassSlot = `${upcoming.subjectCode} at ${upcoming.timeSlot} (${upcoming.section})`;
      } else {
        nextClassSlot = 'All classes done';
      }
    }

    // Attendance pending today
    // For each today class, check if an Attendance record exists for today's date
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    let attendancePendingCount = 0;
    for (const c of todayClasses) {
      const exists = await Attendance.findOne({
        collegeCode,
        subjectCode: c.subjectCode.toUpperCase(),
        date: { $gte: startOfToday, $lte: endOfToday }
      });
      if (!exists) {
        attendancePendingCount++;
      }
    }

    // Assignments pending
    const classes = req.user.assignedClasses || [];
    let assignmentsPendingCount = 0;
    if (classes.length > 0) {
      const orConditions = classes.map(c => ({
        'class.year': c.year,
        'class.section': c.section.toUpperCase(),
        subjectCode: c.subject.toUpperCase()
      }));
      assignmentsPendingCount = await Assignment.countDocuments({
        collegeCode,
        deadline: { $gt: new Date() },
        $or: orConditions
      });
    }

    // Notes uploaded
    const notesCount = await Material.countDocuments({
      collegeCode,
      facultyId,
      type: 'Notes'
    });

    // Notifications count (Circulars/Notices targeting faculty or this department)
    const notificationsCount = await Notice.countDocuments({
      collegeCode,
      $or: [
        { targetRoles: 'faculty' },
        { targetDepartment: dept.toUpperCase() }
      ]
    });

    res.status(200).json({
      todayClassesCount: todayClasses.length,
      nextClassSlot,
      attendancePendingCount,
      assignmentsPendingCount,
      notesUploadedCount: notesCount,
      notificationsCount,
      todayClasses
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 2. TIMETABLE
// =============================================================
const getAssignedTimetable = async (req, res) => {
  try {
    const list = await Timetable.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      'slots.facultyId': req.user._id.toString()
    });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 3. ATTENDANCE MANAGEMENT
// =============================================================
const getStudentsForAttendance = async (req, res) => {
  try {
    const { year, section } = req.query;
    if (!year || !section) {
      return res.status(400).json({ message: 'Year and Section are required.' });
    }
    const dept = req.user.assignedDepartment || '';
    const records = await StudentRecord.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      branch: dept.toUpperCase(),
      section: section.toUpperCase(),
      semester: { $in: [Number(year) * 2 - 1, Number(year) * 2] }
    }).sort({ rollNumber: 1 });

    res.status(200).json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const saveAttendance = async (req, res) => {
  try {
    const { date, timeSlot, subjectCode, section, year, semester, attendanceList, period } = req.body;
    const collegeCode = req.user.collegeCode.toUpperCase();
    const department   = (req.user.assignedDepartment || '').toUpperCase();
    const facultyId    = req.user._id;
    const facultyName  = req.user.fullName || '';

    if (!date || !subjectCode || !section || !attendanceList || !Array.isArray(attendanceList)) {
      return res.status(400).json({ message: 'Missing parameters.' });
    }

    // ── Resolve subject name once ────────────────────────────────────────────
    let subjectName = '';
    try {
      const subjectDoc = await Subject.findOne({ subjectCode: subjectCode.toUpperCase(), collegeCode }).lean();
      if (subjectDoc) subjectName = subjectDoc.name || '';
    } catch (_) {}

    // ── Compute current academic year ─────────────────────────────────────────
    const now = new Date();
    const yr  = now.getFullYear();
    const mo  = now.getMonth() + 1;
    const academicYear = mo >= 6 ? `${yr}-${String(yr + 1).slice(-2)}` : `${yr - 1}-${String(yr).slice(-2)}`;

    const yearNum     = year     ? Number(year)     : 0;
    const semesterNum = semester ? Number(semester) : 0;
    const periodNum   = period   ? Number(period)   : 0;

    // ── Build a roll-number lookup from StudentRecord ─────────────────────────
    const studentIds = attendanceList.map(r => r.studentId).filter(Boolean);
    const studentRecords = await StudentRecord.find(
      { linkedUserId: { $in: studentIds }, collegeCode },
      { linkedUserId: 1, rollNumber: 1, semester: 1 }
    ).lean();
    const rollMap = {};
    for (const sr of studentRecords) {
      if (sr.linkedUserId) rollMap[sr.linkedUserId.toString()] = sr.rollNumber || '';
    }

    // ── Upsert each attendance record ─────────────────────────────────────────
    const saved = [];
    for (const record of attendanceList) {
      const filter = {
        studentId:   record.studentId,
        date:        new Date(date),
        timeSlot:    timeSlot || '',
        subjectCode: subjectCode.toUpperCase(),
        collegeCode
      };
      const patch = {
        status:       record.status,
        remarks:      record.remarks || '',
        // ── New enrichment fields ──────────────────────────────────────────────
        department,
        facultyId,
        facultyName,
        subjectName,
        academicYear,
        year:         yearNum,
        semester:     semesterNum,
        section:      section.toUpperCase(),
        period:       periodNum,
        rollNumber:   rollMap[record.studentId?.toString()] || record.rollNumber || ''
      };

      let att = await Attendance.findOne(filter);
      if (att) {
        Object.assign(att, patch);
        await att.save();
      } else {
        att = await Attendance.create({ ...filter, ...patch });
      }
      saved.push(att);
    }

    // ── Socket.IO — college room + HOD dept room + Student rooms ──────────────────────────────
    const io = req.app.get('io');
    const presentCount = attendanceList.filter(r => r.status === 'Present').length;
    const absentCount  = attendanceList.filter(r => r.status !== 'Present').length;
    const hodPayload = {
      subjectCode: subjectCode.toUpperCase(),
      subjectName,
      section:     section.toUpperCase(),
      year:        yearNum,
      semester:    semesterNum,
      date,
      department,
      facultyId:   facultyId.toString(),
      facultyName,
      presentCount,
      absentCount,
      submittedAt: new Date().toISOString()
    };
    if (io) {
      io.to(collegeCode).emit('attendance_updated', hodPayload);
      // Principal room — Principal is listening for updates on their dashboard
      io.to(`${collegeCode}_PRINCIPAL`).emit('attendance_updated', hodPayload);
      // HOD department room — only HODs of this dept receive this event
      io.to(`${collegeCode}_HOD_${department}`).emit('hod_attendance_updated', hodPayload);

      // Instantly notify each individual student and generate DB notifications
      const { createNotification } = require('./notificationController');
      attendanceList.forEach(async (record) => {
        if (record.studentId) {
          // Notify student socket directly
          io.to(record.studentId.toString()).emit('attendance_updated', {
            subjectCode: subjectCode.toUpperCase(),
            subjectName,
            status: record.status,
            date
          });

          // Create notification for student in DB
          if (record.status === 'Present') {
            try {
              await createNotification(io, record.studentId, {
                title: '📋 Attendance Present',
                message: `You were marked Present in ${subjectCode.toUpperCase()} (${subjectName}) by ${facultyName}`,
                type: 'attendance',
                senderId: facultyId,
                senderName: facultyName,
                link: '/attendance'
              });
            } catch (_) {}
          }
        }
      });
    }

    // ── FCM push to HOD ────────────────────────────────────────────────────────
    await sendFcmNotification({
      collegeCode,
      title: '🔔 Attendance Submitted',
      body: `${facultyName} submitted ${subjectCode.toUpperCase()} (${section.toUpperCase()}) — Present: ${presentCount}, Absent: ${absentCount}`
    });

    await logAction(req.user._id, 'faculty', collegeCode, department,
      `REGISTERED_ATTENDANCE: ${subjectCode.toUpperCase()} Sec ${section} | P:${presentCount} A:${absentCount}`, req);

    res.status(200).json({ message: 'Attendance registered successfully.', count: saved.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAttendanceLogs = async (req, res) => {
  try {
    const { date, subjectCode, section } = req.query;
    const filter = { collegeCode: req.user.collegeCode.toUpperCase(), facultyId: req.user._id };
    if (date)        filter.date        = new Date(date);
    if (subjectCode) filter.subjectCode = subjectCode.toUpperCase();
    if (section)     filter.section     = section.toUpperCase();

    const list = await Attendance.find(filter)
      .populate('studentId', 'fullName rollNumber')
      .sort({ date: -1, timeSlot: 1 })
      .lean();
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 4 & 6. STUDY MATERIALS & NOTES MANAGEMENT
// =============================================================
const getMaterials = async (req, res) => {
  try {
    const list = await Material.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      facultyId: req.user._id.toString()
    }).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createMaterial = async (req, res) => {
  try {
    const { title, type, fileUrl, fileType, subjectCode, section, unit, description } = req.body;
    if (!title || !type) {
      return res.status(400).json({ message: 'Title and Type are required.' });
    }

    const mat = await Material.create({
      title,
      type,
      fileUrl: fileUrl || '',
      fileType: fileType || '',
      subjectCode: subjectCode ? subjectCode.toUpperCase() : '',
      section: section ? section.toUpperCase() : '',
      unit: unit || '',
      description: description || '',
      facultyId: req.user._id.toString(),
      department: req.user.assignedDepartment.toUpperCase(),
      collegeCode: req.user.collegeCode.toUpperCase()
    });

    // Notify students via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('material_created', { material: mat });
    }

    await logAction(req.user._id, 'faculty', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment, `UPLOADED_MATERIAL: ${title} (${type})`, req);
    res.status(201).json({ message: 'Material uploaded successfully.', mat });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, fileUrl, fileType, subjectCode, section, unit, description } = req.body;

    const mat = await Material.findOne({ _id: id, facultyId: req.user._id.toString() });
    if (!mat) return res.status(404).json({ message: 'Material not found or access denied.' });

    if (title) mat.title = title;
    if (type) mat.type = type;
    if (fileUrl !== undefined) mat.fileUrl = fileUrl;
    if (fileType !== undefined) mat.fileType = fileType;
    if (subjectCode !== undefined) mat.subjectCode = subjectCode.toUpperCase();
    if (section !== undefined) mat.section = section.toUpperCase();
    if (unit !== undefined) mat.unit = unit;
    if (description !== undefined) mat.description = description;

    await mat.save();
    res.status(200).json({ message: 'Material updated successfully.', mat });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const mat = await Material.findOneAndDelete({ _id: id, facultyId: req.user._id.toString() });
    if (!mat) return res.status(404).json({ message: 'Material not found or unauthorized.' });
    res.status(200).json({ message: 'Material deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 5. ASSIGNMENTS
// =============================================================
const getAssignments = async (req, res) => {
  try {
    const classes = req.user.assignedClasses || [];
    if (classes.length === 0) return res.status(200).json([]);

    const orConditions = classes.map(c => ({
      'class.year': c.year,
      'class.section': c.section.toUpperCase(),
      subjectCode: c.subject.toUpperCase()
    }));

    const list = await Assignment.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      $or: orConditions
    }).populate('submissions.studentId', 'fullName rollNumber email');

    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createAssignment = async (req, res) => {
  try {
    const { title, description, attachmentUrl, deadline, subjectCode, year, section } = req.body;
    if (!title || !deadline || !subjectCode || !year || !section) {
      return res.status(400).json({ message: 'Missing assignment parameters.' });
    }

    const assignment = await Assignment.create({
      title,
      description: description || '',
      attachmentUrl: attachmentUrl || '',
      deadline: new Date(deadline),
      subjectCode: subjectCode.toUpperCase(),
      class: {
        year: Number(year),
        section: section.toUpperCase()
      },
      collegeCode: req.user.collegeCode.toUpperCase()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('assignment_created', { assignment });
    }

    await sendFcmNotification({
      collegeCode: req.user.collegeCode,
      department: req.user.assignedDepartment.toUpperCase(),
      title: `📝 New Assignment: ${title}`,
      body: `Due: ${new Date(deadline).toLocaleDateString()}. Subject: ${subjectCode.toUpperCase()}`
    });

    await logAction(req.user._id, 'faculty', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment, `CREATED_ASSIGNMENT: ${title}`, req);
    res.status(201).json({ message: 'Assignment published.', assignment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, attachmentUrl, deadline } = req.body;

    const assignment = await Assignment.findOne({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    if (title) assignment.title = title;
    if (description !== undefined) assignment.description = description;
    if (attachmentUrl !== undefined) assignment.attachmentUrl = attachmentUrl;
    if (deadline) assignment.deadline = new Date(deadline);

    await assignment.save();

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('assignment_updated', { assignment });
    }

    res.status(200).json({ message: 'Assignment updated.', assignment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Assignment.findOneAndDelete({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!deleted) return res.status(404).json({ message: 'Assignment not found.' });
    res.status(200).json({ message: 'Assignment deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const gradeAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, grade } = req.body;

    const assignment = await Assignment.findOne({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    const sub = assignment.submissions.find(s => s.studentId.toString() === studentId);
    if (!sub) return res.status(404).json({ message: 'Submission not found.' });

    sub.grade = grade;
    await assignment.save();

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('assignment_graded', { assignment, studentId, grade });
    }

    res.status(200).json({ message: 'Submission graded successfully.', assignment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 7. INTERNAL MARKS (DIRECT PUBLISH)
// =============================================================
const getPublishedMarks = async (req, res) => {
  try {
    const list = await ExamMark.find({
      collegeCode: req.user.collegeCode.toUpperCase()
    }).populate('studentId', 'fullName rollNumber branch section');
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const submitExamMarks = async (req, res) => {
  try {
    const { marksList, subjectCode, maxMarks, type } = req.body;
    const collegeCode = req.user.collegeCode.toUpperCase();

    if (!marksList || !Array.isArray(marksList) || !subjectCode || !type) {
      return res.status(400).json({ message: 'Missing exam mark parameters.' });
    }

    const saved = [];
    for (const record of marksList) {
      let mark = await ExamMark.findOne({
        studentId: record.studentId,
        subjectCode: subjectCode.toUpperCase(),
        type,
        collegeCode
      });

      if (mark) {
        mark.marks = record.marks;
        mark.maxMarks = maxMarks || 100;
        mark.status = 'published'; // Directly published, no HOD approval needed
        await mark.save();
      } else {
        mark = await ExamMark.create({
          studentId: record.studentId,
          subjectCode: subjectCode.toUpperCase(),
          marks: record.marks,
          maxMarks: maxMarks || 100,
          type,
          status: 'published',
          collegeCode
        });
      }
      saved.push(mark);
    }

    await logAction(req.user._id, 'faculty', collegeCode, req.user.assignedDepartment, `PUBLISHED_MARKS: ${subjectCode.toUpperCase()} Type: ${type}`, req);
    res.status(200).json({ message: 'Marks published successfully.', count: saved.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 8. LAB MANAGEMENT
// =============================================================
const getLabRecords = async (req, res) => {
  try {
    const list = await LabRecord.find({
      collegeCode: req.user.collegeCode.toUpperCase()
    });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createLabRecord = async (req, res) => {
  try {
    const { studentId, studentName, subjectCode, section, experimentNumber, experimentName, observationMarks, vivaMarks, recordMarks, status, remarks } = req.body;
    if (!studentId || !subjectCode || !section || !experimentNumber || !experimentName) {
      return res.status(400).json({ message: 'Missing lab record details.' });
    }

    const rec = await LabRecord.create({
      studentId,
      studentName,
      subjectCode: subjectCode.toUpperCase(),
      section: section.toUpperCase(),
      experimentNumber: Number(experimentNumber),
      experimentName,
      observationMarks: observationMarks || 0,
      vivaMarks: vivaMarks || 0,
      recordMarks: recordMarks || 0,
      status: status || 'Completed',
      remarks: remarks || '',
      collegeCode: req.user.collegeCode.toUpperCase()
    });

    res.status(201).json({ message: 'Lab record registered successfully.', rec });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateLabRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { experimentNumber, experimentName, observationMarks, vivaMarks, recordMarks, status, remarks } = req.body;

    const rec = await LabRecord.findOne({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!rec) return res.status(404).json({ message: 'Lab record not found.' });

    if (experimentNumber) rec.experimentNumber = Number(experimentNumber);
    if (experimentName) rec.experimentName = experimentName;
    if (observationMarks !== undefined) rec.observationMarks = Number(observationMarks);
    if (vivaMarks !== undefined) rec.vivaMarks = Number(vivaMarks);
    if (recordMarks !== undefined) rec.recordMarks = Number(recordMarks);
    if (status) rec.status = status;
    if (remarks !== undefined) rec.remarks = remarks;

    await rec.save();
    res.status(200).json({ message: 'Lab record updated.', rec });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteLabRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await LabRecord.findOneAndDelete({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!deleted) return res.status(404).json({ message: 'Lab record not found.' });
    res.status(200).json({ message: 'Lab record deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 9. ANNOUNCEMENTS
// =============================================================
const getAnnouncements = async (req, res) => {
  try {
    const list = await Notice.find({
      collegeCode: req.user.collegeCode.toUpperCase()
    }).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const { title, content, type, targetRoles, targetYear, targetSection } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and Content are required.' });
    }

    const dept = req.user.assignedDepartment || '';
    const announcement = await Notice.create({
      title,
      content,
      type: type || 'department',
      targetRoles: targetRoles || ['student'],
      targetDepartment: dept.toUpperCase(),
      targetYear: targetYear || '',
      targetSection: targetSection ? targetSection.toUpperCase() : '',
      collegeCode: req.user.collegeCode.toUpperCase()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('notice_published', { notice: announcement });
    }

    await logAction(req.user._id, 'faculty', req.user.collegeCode.toUpperCase(), dept, `CREATED_ANNOUNCEMENT: ${title}`, req);
    res.status(201).json({ message: 'Announcement published successfully.', announcement });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Notice.findOneAndDelete({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!deleted) return res.status(404).json({ message: 'Announcement not found.' });
    res.status(200).json({ message: 'Announcement deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 10 & 11. STUDENT ROSTER & SYSTEM NOTIFICATIONS
// =============================================================
const getAssignedStudents = async (req, res) => {
  try {
    const classes = req.user.assignedClasses || [];
    if (classes.length === 0) return res.status(200).json([]);

    const orConditions = classes.map(c => ({
      semester: { $in: [c.year * 2 - 1, c.year * 2] },
      section: c.section.toUpperCase(),
      branch: req.user.assignedDepartment.toUpperCase()
    }));

    const records = await StudentRecord.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      $or: orConditions
    }).populate('linkedUserId', 'email username isActive');

    res.status(200).json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getFacultyNotifications = async (req, res) => {
  try {
    const list = await Notice.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      targetRoles: 'faculty'
    }).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 12. MY PROFILE
// =============================================================
const updateProfileSettings = async (req, res) => {
  try {
    const { fullName, bio, mobileNumber, githubUrl, linkedinUrl, portfolioUrl, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (fullName) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    if (mobileNumber) user.mobileNumber = mobileNumber;
    if (githubUrl !== undefined) user.githubUrl = githubUrl;
    if (linkedinUrl !== undefined) user.linkedinUrl = linkedinUrl;
    if (portfolioUrl !== undefined) user.portfolioUrl = portfolioUrl;

    if (newPassword) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      user.passwordLastChanged = new Date();
    }

    await user.save();
    res.status(200).json({ message: 'Profile updated successfully.', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 13. CLASS DIARY
// =============================================================
const getClassDiary = async (req, res) => {
  try {
    const list = await ClassDiary.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      facultyId: req.user._id.toString()
    }).sort({ date: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createClassDiary = async (req, res) => {
  try {
    const { date, subjectCode, section, topicCovered, homework, remarks, completionStatus } = req.body;
    if (!subjectCode || !section || !topicCovered) {
      return res.status(400).json({ message: 'Missing required diary fields.' });
    }

    const entry = await ClassDiary.create({
      date: date ? new Date(date) : new Date(),
      subjectCode: subjectCode.toUpperCase(),
      section: section.toUpperCase(),
      topicCovered,
      homework: homework || '',
      remarks: remarks || '',
      completionStatus: completionStatus || 'Completed',
      facultyId: req.user._id.toString(),
      collegeCode: req.user.collegeCode.toUpperCase()
    });

    res.status(201).json({ message: 'Diary entry logged.', entry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateClassDiary = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, subjectCode, section, topicCovered, homework, remarks, completionStatus } = req.body;

    const entry = await ClassDiary.findOne({ _id: id, facultyId: req.user._id.toString() });
    if (!entry) return res.status(404).json({ message: 'Diary entry not found.' });

    if (date) entry.date = new Date(date);
    if (subjectCode) entry.subjectCode = subjectCode.toUpperCase();
    if (section) entry.section = section.toUpperCase();
    if (topicCovered) entry.topicCovered = topicCovered;
    if (homework !== undefined) entry.homework = homework;
    if (remarks !== undefined) entry.remarks = remarks;
    if (completionStatus) entry.completionStatus = completionStatus;

    await entry.save();
    res.status(200).json({ message: 'Diary entry updated.', entry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteClassDiary = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ClassDiary.findOneAndDelete({ _id: id, facultyId: req.user._id.toString() });
    if (!deleted) return res.status(404).json({ message: 'Diary entry not found.' });
    res.status(200).json({ message: 'Diary entry deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 14. LEAVE MANAGEMENT
// =============================================================
const applyLeaveRequest = async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;
    const collegeCode = req.user.collegeCode.toUpperCase();

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'Missing leave parameters.' });
    }

    const leave = await LeaveRequest.create({
      userId: req.user._id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
      status: 'pending',
      collegeCode
    });

    await logAction(req.user._id, 'faculty', collegeCode, req.user.assignedDepartment, 'APPLIED_FOR_LEAVE', req);
    res.status(201).json({ message: 'Leave request submitted successfully.', leave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLeaveRequests = async (req, res) => {
  try {
    const list = await LeaveRequest.find({
      userId: req.user._id,
      collegeCode: req.user.collegeCode.toUpperCase()
    }).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 15. STUDENT DOUBTS
// =============================================================
const getDoubts = async (req, res) => {
  try {
    const list = await Doubt.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      facultyId: req.user._id.toString()
    }).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const answerDoubt = async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;
    if (!answer) return res.status(400).json({ message: 'Answer is required.' });

    const doubt = await Doubt.findOne({ _id: id, facultyId: req.user._id.toString() });
    if (!doubt) return res.status(404).json({ message: 'Doubt query not found.' });

    doubt.answer = answer;
    doubt.status = 'Closed';
    await doubt.save();

    res.status(200).json({ message: 'Response registered.', doubt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 16. STUDENT PERFORMANCE ANALYTICS
// =============================================================
const getStudentAnalytics = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode.toUpperCase();
    const classes = req.user.assignedClasses || [];
    if (classes.length === 0) return res.status(200).json({});

    const orConditions = classes.map(c => ({
      semester: { $in: [c.year * 2 - 1, c.year * 2] },
      section: c.section.toUpperCase(),
      branch: req.user.assignedDepartment.toUpperCase()
    }));

    const students = await StudentRecord.find({
      collegeCode,
      $or: orConditions
    });

    const studentIds = students.map(s => s._id.toString());
    const rollNumbers = students.map(s => s.rollNumber.toUpperCase());

    // 1. Attendance analytics
    const attendanceLogs = await Attendance.find({
      collegeCode,
      studentId: { $in: studentIds }
    });

    // 2. Exam marks analytics
    const marksLogs = await ExamMark.find({
      collegeCode,
      studentId: { $in: rollNumbers }
    });

    res.status(200).json({
      studentsCount: students.length,
      attendanceLogs,
      marksLogs
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// 17. FACULTY CALENDAR
// =============================================================
const getCalendarEvents = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode.toUpperCase();
    // Fetch generic college events & workshops
    const events = await Event.find({ collegeCode });
    // Fetch timetable classes
    const timetables = await Timetable.find({
      collegeCode,
      'slots.facultyId': req.user._id.toString()
    });

    const parsedClasses = [];
    timetables.forEach(t => {
      t.slots.forEach(s => {
        if (s.facultyId === req.user._id.toString()) {
          parsedClasses.push({
            title: `Class: ${s.subjectCode} (${t.section})`,
            description: `Room: ${s.room || 'N/A'}, Day: ${t.day}`,
            type: 'class',
            dayOfWeek: t.day,
            time: s.timeSlot
          });
        }
      });
    });

    res.status(200).json({
      collegeEvents: events,
      classes: parsedClasses
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getDashboardStats,
  getAssignedTimetable,
  getStudentsForAttendance,
  saveAttendance,
  getAttendanceLogs,
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  gradeAssignment,
  getPublishedMarks,
  submitExamMarks,
  getLabRecords,
  createLabRecord,
  updateLabRecord,
  deleteLabRecord,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  getAssignedStudents,
  getFacultyNotifications,
  updateProfileSettings,
  getClassDiary,
  createClassDiary,
  updateClassDiary,
  deleteClassDiary,
  applyLeaveRequest,
  getLeaveRequests,
  getDoubts,
  answerDoubt,
  getStudentAnalytics,
  getCalendarEvents
};
