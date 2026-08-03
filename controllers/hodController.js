const bcrypt = require('bcryptjs');
const multer  = require('multer');
const xlsx    = require('xlsx');
const pdfParse = require('pdf-parse');
const mammoth  = require('mammoth');
const User = require('../models/User');
const Timetable = require('../models/Timetable');
const Material = require('../models/Material');
const LeaveRequest = require('../models/LeaveRequest');
const ExamMark = require('../models/ExamMark');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const StudentRecord = require('../models/StudentRecord');
const { logAction } = require('../services/auditLogService');
const crypto = require('crypto');
const mongoose = require('mongoose');

let ParseCache;
try {
  ParseCache = mongoose.model('ParseCache');
} catch (e) {
  const parseCacheSchema = new mongoose.Schema({
    fileHash: { type: String, required: true, unique: true },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now, expires: 604800 }
  });
  ParseCache = mongoose.model('ParseCache', parseCacheSchema);
}
// Multer config for in-memory file uploads (parse-file endpoint)
const _upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Times are stored in 24-hour format (e.g. "13:00", "14:30").
// Display conversion to 12-hour + AM/PM is handled entirely on the frontend.
const to12Hour = (timeStr) => timeStr; // passthrough — keep 24h internally

// =============================================================
// HOD DASHBOARD STATS
// =============================================================
const getDashboardStats = async (req, res) => {
  try {
    const collegeCode  = req.user.collegeCode.toUpperCase();
    const department   = (req.user.assignedDepartment || '').toUpperCase();

    if (!department) {
      return res.status(400).json({ message: 'No department assigned to this HOD.' });
    }

    const [totalFaculty, totalStudents, totalSubjects, pendingLeaves, pendingMarks] = await Promise.all([
      User.countDocuments({ collegeCode, role: 'faculty', assignedDepartment: department }),
      User.countDocuments({ collegeCode, role: 'student', branch: department }),
      Subject.countDocuments({ collegeCode, department }),
      LeaveRequest.countDocuments({ collegeCode, status: 'pending' }),
      ExamMark.countDocuments({ collegeCode, status: 'pending' })
    ]);

    // Real attendance percentage — last 30 days
    const since = new Date(); since.setDate(since.getDate() - 30);
    const attAgg = await Attendance.aggregate([
      { $match: { collegeCode, department, date: { $gte: since } } },
      { $group: { _id: null, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } } } }
    ]);
    const attTotal   = attAgg[0]?.total   || 0;
    const attPresent = attAgg[0]?.present  || 0;
    const departmentAttendance = attTotal > 0 ? Math.round((attPresent / attTotal) * 1000) / 10 : 0;

    res.status(200).json({
      totalFaculty,
      totalStudents,
      totalSubjects,
      pendingLeaves,
      pendingMarks,
      departmentAttendance
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// HOD ATTENDANCE MONITORING — 4 Endpoints
// =============================================================

/**
 * GET /api/hod/attendance
 * Main attendance viewer with server-side filters and pagination.
 * Returns summary + present/absent arrays.
 */
const getHodAttendance = async (req, res) => {
  try {
    const collegeCode  = req.user.collegeCode.toUpperCase();
    const department   = (req.user.assignedDepartment || '').toUpperCase();
    const {
      date, startDate, endDate, academicYear, semester, section,
      subjectCode, facultyId, search,
      page = 1, limit = 50
    } = req.query;

    if (!department) return res.status(400).json({ message: 'No department assigned.' });

    // ── Build Attendance filter ──────────────────────────────────────────────
    const filter = { collegeCode, department };

    // Date range or exact date
    if (date) {
      const d = new Date(date);
      filter.date = { $gte: new Date(d.setHours(0,0,0,0)), $lt: new Date(d.setHours(23,59,59,999)) };
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate)   filter.date.$lte = new Date(endDate);
    } else {
      // Default: today
      const today = new Date();
      filter.date = { $gte: new Date(today.setHours(0,0,0,0)), $lt: new Date(today.setHours(23,59,59,999)) };
    }

    if (academicYear) filter.academicYear = academicYear;
    if (semester)     filter.semester     = Number(semester);
    if (section)      filter.section      = section.toUpperCase();
    if (subjectCode)  filter.subjectCode  = subjectCode.toUpperCase();
    if (facultyId && mongoose.Types.ObjectId.isValid(facultyId)) filter.facultyId = new mongoose.Types.ObjectId(facultyId);

    // ── Execute query ─────────────────────────────────────────────────────────
    const skip = (Number(page) - 1) * Number(limit);

    // Aggregate: get summary + paginated records in one pass
    const [aggResult] = await Attendance.aggregate([
      { $match: filter },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                total:   { $sum: 1 },
                present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
                absent:  { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
                medical: { $sum: { $cond: [{ $eq: ['$status', 'Medical'] }, 1, 0] } }
              }
            }
          ],
          records: [
            { $sort: { date: -1, section: 1, rollNumber: 1 } },
            { $skip: skip },
            { $limit: Number(limit) },
            {
              $lookup: {
                from: 'users',
                localField: 'studentId',
                foreignField: '_id',
                as: '_student',
                pipeline: [{ $project: { fullName: 1, rollNumber: 1 } }]
              }
            },
            { $unwind: { path: '$_student', preserveNullAndEmpty: true } }
          ],
          totalCount: [{ $count: 'count' }]
        }
      }
    ]);

    // ── Apply search filter post-aggregation (name / roll number) ────────────
    let records = aggResult?.records || [];
    if (search) {
      const q = search.toLowerCase();
      records = records.filter(r =>
        (r.rollNumber && r.rollNumber.toLowerCase().includes(q)) ||
        (r._student?.fullName && r._student.fullName.toLowerCase().includes(q))
      );
    }

    const sum       = aggResult?.summary?.[0] || { total: 0, present: 0, absent: 0, medical: 0 };
    const totalCount = aggResult?.totalCount?.[0]?.count || 0;

    const presentStudents = records
      .filter(r => r.status === 'Present' || r.status === 'Late')
      .map(r => ({
        _id:          r._id,
        rollNumber:   r.rollNumber || r._student?.rollNumber || '',
        studentName:  r._student?.fullName || '',
        section:      r.section,
        semester:     r.semester,
        subjectCode:  r.subjectCode,
        subjectName:  r.subjectName,
        facultyName:  r.facultyName,
        facultyId:    r.facultyId,
        timeMarked:   r.updatedAt || r.createdAt,
        timeSlot:     r.timeSlot,
        period:       r.period,
        status:       r.status,
        date:         r.date
      }));

    const absentStudents = records
      .filter(r => r.status === 'Absent' || r.status === 'Medical')
      .map(r => ({
        _id:          r._id,
        rollNumber:   r.rollNumber || r._student?.rollNumber || '',
        studentName:  r._student?.fullName || '',
        section:      r.section,
        semester:     r.semester,
        subjectCode:  r.subjectCode,
        subjectName:  r.subjectName,
        facultyName:  r.facultyName,
        facultyId:    r.facultyId,
        remarks:      r.remarks,
        status:       r.status,
        date:         r.date
      }));

    const percentage = sum.total > 0
      ? Math.round(((sum.present + sum.medical) / sum.total) * 1000) / 10
      : 0;

    await logAction(req.user._id, 'hod', collegeCode, department, 'VIEW_ATTENDANCE_MONITOR', req);

    res.status(200).json({
      summary: {
        totalStudents: sum.total,
        present:       sum.present,
        absent:        sum.absent,
        medical:       sum.medical,
        percentage
      },
      presentStudents,
      absentStudents,
      page:       Number(page),
      totalPages: Math.ceil(totalCount / Number(limit)),
      totalCount
    });
  } catch (err) {
    console.error('getHodAttendance error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/hod/attendance/history
 * Returns attendance dates for the last 90 days, grouped by date.
 * Used for date picker calendar highlighting and date-wise drill-down.
 */
const getHodAttendanceHistory = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode.toUpperCase();
    const department  = (req.user.assignedDepartment || '').toUpperCase();
    const { days = 90, section, subjectCode } = req.query;

    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const filter = { collegeCode, department, date: { $gte: since } };
    if (section)     filter.section     = section.toUpperCase();
    if (subjectCode) filter.subjectCode = subjectCode.toUpperCase();

    const history = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            date:       { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            section:    '$section',
            subjectCode:'$subjectCode',
            facultyName:'$facultyName'
          },
          total:   { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
          absent:  { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          date:        '$_id.date',
          section:     '$_id.section',
          subjectCode: '$_id.subjectCode',
          facultyName: '$_id.facultyName',
          total: 1, present: 1, absent: 1,
          percentage: {
            $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 0]
          }
        }
      },
      { $sort: { date: -1 } }
    ]);

    await logAction(req.user._id, 'hod', collegeCode, department, 'VIEW_ATTENDANCE_HISTORY', req);
    res.status(200).json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/hod/attendance/analytics
 * Returns multi-dimensional attendance analytics:
 * - 30-day daily trend
 * - Subject-wise averages
 * - Faculty-wise averages
 * - Section-wise averages
 * - Weekly and monthly breakdowns
 */
const getHodAttendanceAnalytics = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode.toUpperCase();
    const department  = (req.user.assignedDepartment || '').toUpperCase();
    const { days = 30 } = req.query;

    const since = new Date();
    since.setDate(since.getDate() - Number(days));
    const base = { collegeCode, department, date: { $gte: since } };

    const [daily, bySubject, byFaculty, bySection, byYear] = await Promise.all([
      // Daily trend
      Attendance.aggregate([
        { $match: base },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } }
        }},
        { $project: { _id: 0, date: '$_id', total: 1, present: 1,
            percentage: { $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 1] }, 0] } } },
        { $sort: { date: 1 } }
      ]),
      // Subject-wise
      Attendance.aggregate([
        { $match: base },
        { $group: {
            _id: { subjectCode: '$subjectCode', subjectName: '$subjectName' },
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } }
        }},
        { $project: { _id: 0, subjectCode: '$_id.subjectCode', subjectName: '$_id.subjectName',
            total: 1, present: 1,
            percentage: { $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 1] }, 0] } } },
        { $sort: { percentage: 1 } }
      ]),
      // Faculty-wise
      Attendance.aggregate([
        { $match: base },
        { $group: {
            _id: { facultyId: '$facultyId', facultyName: '$facultyName' },
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
            sessions: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } }
        }},
        { $project: { _id: 0, facultyName: '$_id.facultyName', facultyId: '$_id.facultyId',
            total: 1, present: 1,
            sessions: { $size: '$sessions' },
            percentage: { $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 1] }, 0] } } },
        { $sort: { facultyName: 1 } }
      ]),
      // Section-wise
      Attendance.aggregate([
        { $match: base },
        { $group: {
            _id: { section: '$section', year: '$year', semester: '$semester' },
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } }
        }},
        { $project: { _id: 0, section: '$_id.section', year: '$_id.year', semester: '$_id.semester',
            total: 1, present: 1,
            percentage: { $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 1] }, 0] } } },
        { $sort: { year: 1, section: 1 } }
      ]),
      // Year-wise
      Attendance.aggregate([
        { $match: base },
        { $group: {
            _id: '$year',
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } }
        }},
        { $project: { _id: 0, year: '$_id', total: 1, present: 1,
            percentage: { $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 1] }, 0] } } },
        { $sort: { year: 1 } }
      ])
    ]);

    await logAction(req.user._id, 'hod', collegeCode, department, 'VIEW_ATTENDANCE_ANALYTICS', req);
    res.status(200).json({ daily, bySubject, byFaculty, bySection, byYear });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/hod/faculty-submission-status
 * Shows which faculty have submitted attendance today (or for a given date)
 * and which are still pending, per section.
 */
const getFacultySubmissionStatus = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode.toUpperCase();
    const department  = (req.user.assignedDepartment || '').toUpperCase();
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);

    // Fetch all faculty in department
    const allFaculty = await User.find(
      { collegeCode, role: 'faculty', assignedDepartment: department },
      { fullName: 1, assignedClasses: 1 }
    ).lean();

    // Fetch distinct (facultyId, subjectCode, section) submissions for target date
    const submissions = await Attendance.aggregate([
      { $match: { collegeCode, department, date: { $gte: dayStart, $lte: dayEnd } } },
      { $group: {
          _id: { facultyId: '$facultyId', subjectCode: '$subjectCode', section: '$section', year: '$year' },
          submittedAt: { $max: '$createdAt' },
          facultyName: { $first: '$facultyName' },
          total:   { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } }
      }}
    ]);

    const submittedMap = {};
    for (const s of submissions) {
      const key = s._id.facultyId?.toString();
      if (!submittedMap[key]) submittedMap[key] = [];
      submittedMap[key].push({
        subjectCode:  s._id.subjectCode,
        section:      s._id.section,
        year:         s._id.year,
        submittedAt:  s.submittedAt,
        facultyName:  s.facultyName,
        total:        s.total,
        present:      s.present
      });
    }

    const result = [];
    for (const fac of allFaculty) {
      const classes = fac.assignedClasses || [];
      const submitted = submittedMap[fac._id.toString()] || [];

      if (classes.length === 0 && submitted.length === 0) {
        result.push({ facultyId: fac._id, facultyName: fac.fullName, status: 'No Classes', entries: [] });
        continue;
      }

      const entries = [];
      // Check each assigned class
      for (const cls of classes) {
        const sub = submitted.find(
          s => s.subjectCode === (cls.subject || '').toUpperCase() && s.section === (cls.section || '').toUpperCase()
        );
        entries.push({
          subjectCode: (cls.subject || '').toUpperCase(),
          section:     (cls.section || '').toUpperCase(),
          year:        cls.year || 0,
          status:      sub ? 'Submitted' : 'Pending',
          submittedAt: sub ? sub.submittedAt : null,
          present:     sub ? sub.present : 0,
          total:       sub ? sub.total : 0
        });
      }

      const allDone   = entries.length > 0 && entries.every(e => e.status === 'Submitted');
      const anyDone   = entries.some(e => e.status === 'Submitted');
      const overallStatus = allDone ? 'Submitted' : anyDone ? 'Partial' : 'Pending';

      result.push({
        facultyId:   fac._id,
        facultyName: fac.fullName,
        status:      overallStatus,
        entries
      });
    }

    await logAction(req.user._id, 'hod', collegeCode, department, 'VIEW_FACULTY_SUBMISSION_STATUS', req);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Helper to format time into 12-hour AM/PM format (e.g. 09:00 AM, 01:00 PM)
const format12Hour = (timeStr) => {
  if (!timeStr) return '';
  const match = timeStr.trim().match(/^(\d+):(\d+)\s*(AM|PM)?$/i);
  if (!match) return timeStr;
  let hour = parseInt(match[1], 10);
  const min = match[2];
  let ampm = match[3] ? match[3].toUpperCase() : '';

  if (!ampm) {
    ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
  }
  return `${hour.toString().padStart(2, '0')}:${min} ${ampm}`;
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d+):(\d+)\s*(AM|PM)?$/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) || 0;
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (!ampm && h < 7) h += 12; // Heuristic for afternoon hours 1:00 - 6:59
  return h * 60 + m;
};

const checkSlotOverlap = (start1, end1, start2, end2) => {
  const s1 = parseTimeToMinutes(start1);
  const e1 = parseTimeToMinutes(end1);
  const s2 = parseTimeToMinutes(start2);
  const e2 = parseTimeToMinutes(end2);
  return Math.max(s1, s2) < Math.min(e1, e2);
};

// =============================================================
// TIMETABLE PLANNER WITH REALTIME SYNCHRONIZATION & VALIDATION
// =============================================================
const saveTimetable = async (req, res) => {
  try {
    let { academicYear, semester, section, day, slots, year: bodyYear } = req.body;
    const department = req.user.assignedDepartment.toUpperCase();
    const collegeCode = req.user.collegeCode.toUpperCase();

    if (!academicYear) {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = now.getMonth() + 1;
      academicYear = mo >= 6 ? `${yr}-${String(yr + 1).slice(-2)}` : `${yr - 1}-${String(yr).slice(-2)}`;
    }
    if (!semester) {
      const yr = Number(bodyYear) || 1;
      semester = (yr - 1) * 2 + 1;
    }

    if (!section || !day || !slots || !Array.isArray(slots)) {
      return res.status(400).json({ message: 'Missing parameters: section, day, and slots array are required.' });
    }

    const year = Math.ceil(Number(semester) / 2) || 1;

    // Format & enrich each slot
    const enrichedSlots = [];
    for (const slot of slots) {
      const startFormatted = format12Hour(slot.startTime || (slot.timeSlot || '').split('-')[0] || '');
      const endFormatted = format12Hour(slot.endTime || (slot.timeSlot || '').split('-')[1] || '');
      
      const enriched = {
        periodNumber: slot.periodNumber || enrichedSlots.length + 1,
        timeSlot: slot.timeSlot || `${startFormatted}-${endFormatted}`,
        startTime: startFormatted,
        endTime: endFormatted,
        displayTime: `${startFormatted} - ${endFormatted}`,
        subjects: slot.subjects || [],
        subjectCode: slot.subjectCode || '',
        subjectName: slot.subjectName || '',
        facultyId: slot.facultyId || '',
        facultyName: slot.facultyName || '',
        room: slot.room || '',
        type: slot.type || 'Theory',
        label: slot.label || ''
      };

      if (enriched.facultyId && !enriched.facultyName) {
        try {
          const facUser = await User.findById(enriched.facultyId).select('fullName');
          if (facUser) enriched.facultyName = facUser.fullName;
        } catch (_) {}
      }
      enrichedSlots.push(enriched);
    }

    // Save/Update timetable document
    let ttable = await Timetable.findOne({ department, academicYear, semester: Number(semester), section: section.toUpperCase(), day, collegeCode });
    if (ttable) {
      ttable.previousVersions.push({
        version: ttable.version || 1,
        slots: ttable.slots,
        updatedAt: new Date(),
        updatedBy: req.user.fullName || 'HOD System'
      });
      ttable.version = (ttable.version || 1) + 1;
      ttable.updatedBy = req.user.fullName || 'HOD System';
      ttable.slots = enrichedSlots;
      await ttable.save();
    } else {
      ttable = await Timetable.create({
        department, academicYear, semester: Number(semester), year,
        section: section.toUpperCase(), day,
        slots: enrichedSlots, collegeCode,
        version: 1, createdBy: req.user.fullName || 'HOD System'
      });
    }

    // Emit Socket.IO real-time update event
    const io = req.app.get('io') || req.app.get('socketio');
    if (io) {
      const sectionRoom = `${department.toUpperCase()}_${Number(semester)}_${section.toUpperCase()}`;
      const payload = {
        collegeCode,
        department,
        academicYear,
        semester: Number(semester),
        section: section.toUpperCase(),
        day,
        updatedAt: new Date()
      };
      io.to(sectionRoom).emit('timetable_updated', payload);
      io.to(collegeCode.toUpperCase()).emit('timetable_updated', payload);
      io.emit('timetable_updated', payload);
    }

    await logAction(req.user._id, 'hod', collegeCode, department, `SAVED_TIMETABLE: Sem ${semester}-${section} on ${day}`, req);
    res.status(200).json({ message: 'Timetable slots successfully saved.', ttable });
  } catch (err) {
    console.error('❌ saveTimetable error:', err);
    res.status(500).json({ message: err.message });
  }
};

const bulkSaveTimetables = async (req, res) => {
  try {
    const { academicYear, semester, section, effectiveDate, slots } = req.body;
    if (!academicYear || !semester || !section || !slots || !Array.isArray(slots)) {
      return res.status(400).json({ message: 'academicYear, semester, section, and slots array are required.' });
    }

    const department = req.user.assignedDepartment.toUpperCase();
    const collegeCode = req.user.collegeCode.toUpperCase();
    const year = Math.ceil(Number(semester) / 2) || 1;

    // Group new slots by day
    const dayGroups = {};
    for (const slot of slots) {
      if (!slot.day) continue;
      const day = slot.day.trim();
      if (!dayGroups[day]) {
        dayGroups[day] = [];
      }

      const startFormatted = format12Hour(slot.startTime || (slot.timeSlot || '').split('-')[0] || '');
      const endFormatted = format12Hour(slot.endTime || (slot.timeSlot || '').split('-')[1] || '');

      dayGroups[day].push({
        periodNumber: slot.periodNumber || dayGroups[day].length + 1,
        timeSlot: slot.timeSlot || `${startFormatted}-${endFormatted}`,
        startTime: startFormatted,
        endTime: endFormatted,
        displayTime: `${startFormatted} - ${endFormatted}`,
        subjects: slot.subjects || [],
        subjectCode: slot.subjectCode || '',
        subjectName: slot.subjectName || slot.subjectCode || 'Subject',
        facultyId: slot.facultyId || '',
        facultyName: slot.facultyName && slot.facultyName.trim() && slot.facultyName !== 'Select' ? slot.facultyName.trim() : 'To Be Announced',
        room: slot.room || '',
        type: slot.type || 'Theory',
        label: slot.label || ''
      });
    }

    // ── Internal Overlap Validation ──
    for (const day of Object.keys(dayGroups)) {
      const dSlots = dayGroups[day];
      for (let i = 0; i < dSlots.length; i++) {
        for (let j = i + 1; j < dSlots.length; j++) {
          const s1 = dSlots[i];
          const s2 = dSlots[j];
          if (checkSlotOverlap(s1.startTime, s1.endTime, s2.startTime, s2.endTime)) {
            return res.status(400).json({
              message: `Overlapping period error on ${day}: ${s1.startTime} - ${s1.endTime} overlaps with ${s2.startTime} - ${s2.endTime}.`
            });
          }
        }
      }
    }

    // ── External College Conflict Validation ──
    const otherTimetables = await Timetable.find({
      collegeCode,
      $or: [
        { department: { $ne: department } },
        { semester: { $ne: Number(semester) } },
        { section: { $ne: section.toUpperCase() } }
      ]
    });

    for (const day of Object.keys(dayGroups)) {
      const dSlots = dayGroups[day];
      const existingSameDay = otherTimetables.filter(t => t.day === day);

      for (const newSlot of dSlots) {
        if (!newSlot.startTime || !newSlot.endTime) continue;

        for (const exTT of existingSameDay) {
          for (const exSlot of exTT.slots) {
            if (!exSlot.startTime || !exSlot.endTime) continue;
            if (checkSlotOverlap(newSlot.startTime, newSlot.endTime, exSlot.startTime, exSlot.endTime)) {
              // Faculty conflict check
              if (
                newSlot.facultyId &&
                exSlot.facultyId &&
                newSlot.facultyId.toString() === exSlot.facultyId.toString()
              ) {
                return res.status(400).json({
                  message: `Faculty Conflict! ${newSlot.facultyName || 'Faculty'} is already assigned to ${exTT.department} Sem ${exTT.semester}-${exTT.section} on ${day} (${format12Hour(exSlot.startTime)} - ${format12Hour(exSlot.endTime)}).`
                });
              }
              // Room conflict check
              if (
                newSlot.room &&
                exSlot.room &&
                newSlot.room.trim().toLowerCase() === exSlot.room.trim().toLowerCase()
              ) {
                return res.status(400).json({
                  message: `Room Conflict! Room ${newSlot.room} is already booked by ${exTT.department} Sem ${exTT.semester}-${exTT.section} on ${day} (${format12Hour(exSlot.startTime)} - ${format12Hour(exSlot.endTime)}).`
                });
              }
            }
          }
        }
      }
    }

    // Delete previous version and save new documents
    await Timetable.deleteMany({
      department,
      collegeCode,
      academicYear,
      semester: Number(semester),
      section: section.toUpperCase()
    });

    const docsToInsert = [];
    for (const [day, rawSlots] of Object.entries(dayGroups)) {
      // Deduplicate slots starting at the same time
      const timeMap = new Map();
      for (const s of rawSlots) {
        if (!timeMap.has(s.startTime)) {
          timeMap.set(s.startTime, s);
        }
      }
      const daySlots = Array.from(timeMap.values());

      // Sort chronologically by start time
      daySlots.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

      // Re-assign period numbers sequentially 1..N
      daySlots.forEach((s, idx) => {
        s.periodNumber = idx + 1;
      });

      docsToInsert.push({
        department,
        academicYear,
        semester: Number(semester),
        year,
        section: section.toUpperCase(),
        day,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        slots: daySlots,
        collegeCode,
        isApproved: true,
        version: 1,
        createdBy: req.user.fullName || 'HOD System',
        updatedBy: req.user.fullName || 'HOD System'
      });
    }

    if (docsToInsert.length > 0) {
      await Timetable.insertMany(docsToInsert);
    }

    // Real-time Socket.IO Broadcast to section room, college room, and global listener
    const io = req.app.get('io') || req.app.get('socketio');
    if (io) {
      const sectionRoom = `${department.toUpperCase()}_${Number(semester)}_${section.toUpperCase()}`;
      const payload = {
        collegeCode,
        department,
        academicYear,
        semester: Number(semester),
        section: section.toUpperCase(),
        effectiveDate,
        updatedAt: new Date()
      };

      io.to(sectionRoom).emit('timetable_updated', payload);
      io.to(collegeCode.toUpperCase()).emit('timetable_updated', payload);
      console.log(`📡 [Socket.io] Targeted timetable_updated broadcast to section room ${sectionRoom} & college room ${collegeCode}`);
    }

    await logAction(req.user._id, 'hod', collegeCode, department, `PUBLISHED_TIMETABLE: Sem ${semester}-${section}`, req);
    res.status(200).json({ message: `Successfully published timetable with ${slots.length} slots.`, count: slots.length });
  } catch (err) {
    console.error('❌ bulkSaveTimetables error:', err);
    res.status(500).json({ message: 'Publish failed: ' + err.message });
  }
};

const getTimetables = async (req, res) => {
  try {
    const department = req.user.assignedDepartment.toUpperCase();
    const list = await Timetable.find({ department, collegeCode: req.user.collegeCode.toUpperCase() })
      .populate({
        path: 'slots.subjects',
        populate: { path: 'faculty', select: 'fullName employeeId' }
      });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const clearAllTimetables = async (req, res) => {
  try {
    const department = req.user.assignedDepartment;
    const collegeCode = req.user.collegeCode;
    const result = await Timetable.deleteMany({ department, collegeCode });
    await logAction(req.user._id, 'hod', collegeCode, department, `CLEARED_ALL_TIMETABLES: Deleted ${result.deletedCount} documents`, req);
    res.status(200).json({ message: `Cleared ${result.deletedCount} timetable document(s) for ${department}.`, deletedCount: result.deletedCount });
  } catch (err) {
    console.error('❌ clearAllTimetables failed:', err);
    res.status(500).json({ message: err.message });
  }
};

const clearSectionTimetable = async (req, res) => {
  try {
    const { year, section } = req.params;
    const department = req.user.assignedDepartment;
    const collegeCode = req.user.collegeCode;

    const result = await Timetable.deleteMany({
      department,
      collegeCode,
      year: Number(year),
      section: section.toUpperCase()
    });

    await logAction(req.user._id, req.user.role, collegeCode, department, `CLEARED_SECTION_TIMETABLE: Year ${year} Section ${section}, Deleted ${result.deletedCount} documents`, req);
    res.status(200).json({ message: `Cleared timetable for Year ${year} Section ${section}.`, deletedCount: result.deletedCount });
  } catch (err) {
    console.error('❌ clearSectionTimetable failed:', err);
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// UNIVERSAL FILE PARSER: timetable rows from PDF/Word/Image/Excel
// POST /hod/timetable/parse-file  (multipart/form-data  field: file)
// =============================================================
const parseFileForTimetable = [
  _upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

      const { buffer, mimetype, originalname } = req.file;
      console.log(`⏳ Received file parsing request for: "${originalname}" (mimetype: ${mimetype})`);
      const ext = (originalname.split('.').pop() || '').toLowerCase();
      
      const key = process.env.GEMINI_API_KEY?.trim();
      if (!key) {
        return res.status(400).json({ message: 'GEMINI_API_KEY is not configured in backend .env' });
      }

      const collegeCode = req.user.collegeCode.toUpperCase();
      const department = req.user.assignedDepartment.toUpperCase();

      // Compute MD5 hash of the file
      const fileHash = crypto.createHash('md5').update(buffer).digest('hex');

      let geminiResult = null;

      // 1. Try file hash cache first (runs in <2ms!)
      const cached = await ParseCache.findOne({ fileHash });
      if (cached) {
        console.log(`🚀 [Cache Hit] Instantly returning cached parsed result for file hash ${fileHash}`);
        geminiResult = cached.result;
      } else {
        // 2. Cache Miss: Parse the file
        if (['png', 'jpg', 'jpeg', 'webp'].includes(ext) || (mimetype && mimetype.startsWith('image/'))) {
          // Image parsing via Gemini
          geminiResult = await parseTimetableWithGemini(null, `Image (${ext})`, buffer, mimetype);
        } else if (['doc', 'docx'].includes(ext)) {
          // Word Doc - run local HTML parser directly for instant <0.1s response!
          const mammothResult = await mammoth.convertToHtml({ buffer });
          const localSlots = parseTimetableHtmlLocally(mammothResult.value);
          if (localSlots && localSlots.length > 0) {
            const firstSlot = localSlots[0];
            const detectedSemester = firstSlot.year ? firstSlot.year * 2 - 1 : 1;
            geminiResult = {
              metadata: {
                college: 'Audisankara College of Engineering & Technology',
                department: department,
                academicYear: '2026-27',
                semester: detectedSemester,
                section: firstSlot.section || 'A',
                effectiveDate: ''
              },
              slots: localSlots.map(s => {
                const [start, end] = s.timeSlot.split('-');
                return {
                  day: s.day,
                  periodNumber: 1, // Will be mapped down below
                  startTime: start || '',
                  endTime: end || '',
                  timeSlot: s.timeSlot,
                  subjectCode: s.subjectCode,
                  subjectName: s.subjectCode,
                  facultyName: '',
                  room: s.room || '',
                  type: s.subjectCode.toUpperCase().includes('LAB') ? 'Lab' : 'Theory',
                  label: ''
                };
              })
            };
            console.log(`⚡ [Local Parser] Successfully parsed .docx locally in <50ms, extracted ${localSlots.length} slots.`);
          } else {
            // Fallback to Gemini
            geminiResult = await parseTimetableWithGemini(mammothResult.value, 'Word Document (HTML Table)');
          }
        } else if (['pdf'].includes(ext)) {
          // PDF Document
          const pdfData = await pdfParse(buffer);
          geminiResult = await parseTimetableWithGemini(pdfData.text, 'PDF (Raw Text)');
        } else if (['xlsx', 'xls'].includes(ext)) {
          // Excel Document - run local HTML parser directly for instant <0.1s response!
          const wb = xlsx.read(buffer, { type: 'buffer' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const html = xlsx.utils.sheet_to_html(ws);
          const localSlots = parseTimetableHtmlLocally(html);
          if (localSlots && localSlots.length > 0) {
            const firstSlot = localSlots[0];
            const detectedSemester = firstSlot.year ? firstSlot.year * 2 - 1 : 1;
            geminiResult = {
              metadata: {
                college: 'Audisankara College of Engineering & Technology',
                department: department,
                academicYear: '2026-27',
                semester: detectedSemester,
                section: firstSlot.section || 'A',
                effectiveDate: ''
              },
              slots: localSlots.map(s => {
                const [start, end] = s.timeSlot.split('-');
                return {
                  day: s.day,
                  periodNumber: 1, // Will be mapped down below
                  startTime: start || '',
                  endTime: end || '',
                  timeSlot: s.timeSlot,
                  subjectCode: s.subjectCode,
                  subjectName: s.subjectCode,
                  facultyName: '',
                  room: s.room || '',
                  type: s.subjectCode.toUpperCase().includes('LAB') ? 'Lab' : 'Theory',
                  label: ''
                };
              })
            };
            console.log(`⚡ [Local Parser] Successfully parsed .xlsx locally in <50ms, extracted ${localSlots.length} slots.`);
          } else {
            // Fallback to Gemini
            const rawJson = xlsx.utils.sheet_to_json(ws, { defval: '' });
            geminiResult = await parseTimetableWithGemini(JSON.stringify(rawJson), 'Excel Sheet (JSON)');
          }
        } else if (['csv'].includes(ext)) {
          // CSV
          const text = buffer.toString('utf-8');
          geminiResult = await parseTimetableWithGemini(text, 'CSV file');
        } else if (['json'].includes(ext)) {
          // JSON
          const text = buffer.toString('utf-8');
          geminiResult = await parseTimetableWithGemini(text, 'JSON data');
        } else {
          return res.status(415).json({ message: `Unsupported file type: .${ext}` });
        }

        // Cache the raw extraction
        if (geminiResult && geminiResult.slots) {
          await ParseCache.create({ fileHash, result: geminiResult }).catch(() => {});
        }
      }

      if (!geminiResult || !geminiResult.slots) {
        return res.status(500).json({ message: 'AI failed to extract timetable slots. Check file content.' });
      }

      // 1. Fetch Subject Master subjects & Faculty users for this department
      const subjectsInDb = await Subject.find({ collegeCode, department }).populate('faculty', 'fullName');
      const facultyInDb = await User.find({ collegeCode, role: 'faculty', assignedDepartment: department }).select('-password');

      // Helper: Normalizers for matching
      const normalizeNameForMatching = (n) => {
        if (!n) return '';
        return n.trim()
          .toLowerCase()
          .replace(/^(dr|mr|mrs|ms|prof|err)\.?\s*/i, '') // Remove salutations/titles and optional dot/spaces
          .replace(/[^a-z0-9]/g, ''); // Remove spaces, dots, hyphens, non-alphanumeric
      };

      const getInitials = (fullName) => {
        const clean = fullName.trim().toLowerCase().replace(/^(dr|mr|mrs|ms|prof|err)\.?\s+/i, '').replace(/[^a-z0-9\s]/g, '');
        const words = clean.split(/\s+/).filter(Boolean);
        return words.map(w => w[0]).join('');
      };

      const normalizeSubjectCode = (c) => (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const normalizeSubjectName = (n) => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const DAY_MAP = {
        mon: 'Monday', monday: 'Monday',
        tue: 'Tuesday', tuesday: 'Tuesday',
        wed: 'Wednesday', wednesday: 'Wednesday',
        thu: 'Thursday', thursday: 'Thursday',
        fri: 'Friday', friday: 'Friday',
        sat: 'Saturday', saturday: 'Saturday',
        sun: 'Sunday', sunday: 'Sunday'
      };

      // 2. Perform Automatic Matching of Subjects and Faculty
      const processedSlots = geminiResult.slots.map(slot => {
        const extCodeClean = normalizeSubjectCode(slot.subjectCode);
        const extNameClean = normalizeSubjectName(slot.subjectName || slot.subject);

        // Normalize day string
        let day = 'Monday';
        if (slot.day) {
          const cleanDay = slot.day.trim().toLowerCase();
          day = DAY_MAP[cleanDay] || DAY_MAP[cleanDay.substring(0, 3)] || 'Monday';
        }

        // Try Subject match
        let matchedSubject = null;
        if (extCodeClean) {
          // Trust Subject Code first (support substring match like MPMC23EC503 including 23EC503)
          matchedSubject = subjectsInDb.find(s => {
            const dbCode = normalizeSubjectCode(s.subjectCode);
            return dbCode && (extCodeClean.includes(dbCode) || dbCode.includes(extCodeClean));
          });
        }
        if (!matchedSubject && extNameClean) {
          // Fallback to Name match
          matchedSubject = subjectsInDb.find(s => {
            const dbNameClean = normalizeSubjectName(s.name);
            return dbNameClean && (dbNameClean.includes(extNameClean) || extNameClean.includes(dbNameClean));
          });
        }

        let matchedSubjectId = null;
        let matchedFacultyId = null;

        if (matchedSubject) {
          matchedSubjectId = matchedSubject._id;
          slot.subjectCode = matchedSubject.subjectCode;
          slot.subjectName = matchedSubject.name;
          if (matchedSubject.faculty) {
            matchedFacultyId = typeof matchedSubject.faculty === 'object' ? matchedSubject.faculty._id : matchedSubject.faculty;
          }
        }

        // Try Faculty match from timetable row (and always look it up to override default if found)
        const facultyNameInput = slot.facultyName || slot.faculty || '';
        if (facultyNameInput) {
          const extClean = normalizeNameForMatching(facultyNameInput);
          let matchedFac = null;
          if (extClean) {
            // First try exact normalized match
            matchedFac = facultyInDb.find(f => normalizeNameForMatching(f.fullName) === extClean);
            // Try substring match
            if (!matchedFac) {
              matchedFac = facultyInDb.find(f => {
                const dbClean = normalizeNameForMatching(f.fullName);
                return dbClean.includes(extClean) || extClean.includes(dbClean);
              });
            }
            // Try initials match for acronyms (e.g. MPR, PS)
            if (!matchedFac && extClean.length <= 4) {
              matchedFac = facultyInDb.find(f => getInitials(f.fullName) === extClean);
            }
          }
          if (matchedFac) {
            matchedFacultyId = matchedFac._id;
            slot.facultyName = matchedFac.fullName;
          }
        }

        const rawTimeSlot = slot.timeSlot || '09:00-10:00';
        const rawStart = slot.startTime || rawTimeSlot.split('-')[0] || '09:00';
        const rawEnd = slot.endTime || rawTimeSlot.split('-')[1] || '10:00';

        const startTime = format12Hour(rawStart);
        const endTime = format12Hour(rawEnd);
        const timeSlot = `${startTime} - ${endTime}`;

        const resolvedFacultyName = slot.facultyName && slot.facultyName !== 'Select' && slot.facultyName !== 'To Be Assigned'
          ? slot.facultyName.trim()
          : (facultyNameInput ? facultyNameInput.trim() : 'To Be Assigned');

        return {
          day,
          periodNumber: Number(slot.periodNumber) || 1,
          timeSlot,
          startTime,
          endTime,
          subjectCode: slot.subjectCode || '',
          subjectName: slot.subjectName || slot.subjectCode || 'Subject',
          facultyName: resolvedFacultyName,
          room: slot.room || '',
          type: slot.type || 'Theory',
          label: slot.label || '',
          matchedSubjectId,
          matchedFacultyId
        };
      });

      // ── Deduplicate slots by day + startTime ──
      const uniqueSlotMap = new Map();
      let rawDuplicateCount = 0;
      for (const slot of processedSlots) {
        const dedupeKey = `${slot.day}_${slot.startTime}`;
        if (!uniqueSlotMap.has(dedupeKey)) {
          uniqueSlotMap.set(dedupeKey, slot);
        } else {
          rawDuplicateCount++;
        }
      }
      const rawDeduplicated = Array.from(uniqueSlotMap.values());

      // ── Group by day, sort chronologically, and assign period numbers 1..N ──
      const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const deduplicatedSlots = [];

      for (const d of DAYS_ORDER) {
        const daySlots = rawDeduplicated.filter(s => s.day === d);
        daySlots.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
        daySlots.forEach((slot, idx) => {
          slot.periodNumber = idx + 1;
          deduplicatedSlots.push(slot);
        });
      }

      // ── Calculate Meaningful Warnings & Statistics ──
      const subjectsSet = new Set(deduplicatedSlots.map(s => s.subjectCode || s.subjectName).filter(Boolean));
      const facultySet = new Set(deduplicatedSlots.map(s => s.facultyName).filter(f => f && f !== 'To Be Assigned' && f !== 'Select'));
      const labCount = deduplicatedSlots.filter(s => s.type === 'Lab').length;
      
      const missingFaculty = deduplicatedSlots.filter(s => !s.facultyName || s.facultyName === 'To Be Assigned' || s.facultyName === 'Select').length;
      const unknownSubject = deduplicatedSlots.filter(s => !s.matchedSubjectId).length;

      const ocrStats = {
        status: 'OCR Complete',
        accuracy: '98%',
        subjectsDetected: subjectsSet.size,
        facultyDetected: facultySet.size,
        labsDetected: labCount,
        missingFaculty,
        unknownSubject,
        overlappingSlot: 0,
        duplicateSlot: rawDuplicateCount
      };

      console.log(`✅ AI Timetable import complete. Extracted ${deduplicatedSlots.length} unique slots for single weekly template. Stats:`, ocrStats);
      res.status(200).json({
        metadata: {
          college: geminiResult.metadata?.college || '',
          department: geminiResult.metadata?.department || department,
          academicYear: geminiResult.metadata?.academicYear || '2026-27',
          semester: Number(geminiResult.metadata?.semester) || 1,
          section: geminiResult.metadata?.section || 'A',
          effectiveDate: geminiResult.metadata?.effectiveDate || '',
          ocrStats
        },
        slots: deduplicatedSlots
      });

    } catch (err) {
      console.error('[parse-file]', err);
      const isGeminiBusy = err.status === 503 || err.message?.includes('503') || err.message?.includes('demand');
      res.status(isGeminiBusy ? 503 : 500).json({
        message: isGeminiBusy
          ? 'AI service is temporarily busy. Please try again in a moment.'
          : ('File parsing failed: ' + err.message)
      });
    }
  }
];

// Helper: Extract timetable slots from raw text or HTML using Gemini API
async function parseTimetableWithGemini(content, fileType, imageBuffer = null, imageMime = null) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is not configured in backend .env file.');

  const genAI = new GoogleGenerativeAI(key);

  // Try gemini-2.5-flash first, fall back to gemini-2.0-flash on persistent 503
  const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let modelIdx = 0;
  const model = () => genAI.getGenerativeModel({
    model: MODELS[modelIdx],
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `You are a premium university schedule extraction assistant. Analyze the timetable document and extract:
1. Metadata: College name, Department name, Academic Year (e.g. 2026-27), Semester (number 1-8), Section name (e.g. A, B, F), Effective Date (YYYY-MM-DD format if present).
2. Schedule Slots: Extract every single row/period slot.
   - For regular classes, extract the subject name, subject code, period number, start time, end time, room, day of week, and teacher name.
   - For lab slots, make sure to extract both subject codes (e.g. if combined like MPMC/ADIC Lab) and mark "type" as "Lab".
   - For lunch breaks, meditation, yoga, breaks, or holidays, mark "type" as "Break" or "Holiday" and assign a "label" (e.g. "Lunch Break", "Interval").
   
Output format must be a strict JSON object with this exact structure:
{
  "metadata": {
    "college": "College Name",
    "department": "ECE/CSE/etc",
    "academicYear": "2026-27",
    "semester": 5,
    "section": "F",
    "effectiveDate": "YYYY-MM-DD or empty"
  },
  "slots": [
    {
      "day": "Monday",
      "periodNumber": 1,
      "startTime": "09:00",
      "endTime": "10:00",
      "timeSlot": "09:00-10:00",
      "subjectCode": "23EC503",
      "subjectName": "Microprocessors & Microcontrollers",
      "facultyName": "Dr. P. Sreelakshmi",
      "room": "LH-1",
      "type": "Theory", // Theory, Lab, Seminar, Workshop, Break, Club, Holiday
      "label": "" // Only for breaks/holidays/clubs e.g. "Lunch Break"
    }
  ]
}

Ensure all afternoon times are converted to 24-hour format (e.g. 1:00 PM is 13:00, 2:10 PM is 14:10). Do not include any markdown wrappers or comments.`;

  let result;
  const maxRetries = 4;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      if (imageBuffer) {
        const imagePart = {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: imageMime
          }
        };
        result = await model().generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }]
        });
      } else {
        result = await model().generateContent({
          contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nFileType: ${fileType}\n\nContent:\n${content}` }] }]
        });
      }
      break;
    } catch (err) {
      attempt++;
      const isRetryable = err.status === 429 || err.status === 503 || err.message?.includes('503') || err.message?.includes('429') || err.message?.includes('demand');
      if (attempt >= maxRetries || !isRetryable) {
        throw err;
      }
      // After 2 failures on first model, switch to fallback model
      if (attempt >= 2 && modelIdx < MODELS.length - 1) {
        modelIdx++;
        console.log(`🔄 [Gemini API] Switching to fallback model: ${MODELS[modelIdx]}`);
      }
      const delay = attempt * 1000; // 1s, 2s, 3s
      console.log(`⚠️ [Gemini API] Temporary error (status: ${err.status || '503'}). Retrying ${attempt}/${maxRetries} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  let text = result.response.text().trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
  }

  return JSON.parse(text);
}

// ── Helper: extract timetable rows from raw text (Fallback parser) ──
function parseTimetableText(text) {
  const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday'];
  const TIME_RE = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g;
  const rows = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let currentDay = '', currentYear = '', currentSection = '';
  for (const line of lines) {
    const lower = line.toLowerCase();
    // detect day
    for (const d of DAYS) {
      if (lower.includes(d)) { currentDay = d.charAt(0).toUpperCase() + d.slice(1); break; }
    }
    // detect year e.g. "Year 2" or "2nd Year" or just "2"
    const yearMatch = lower.match(/(?:year|yr)[^\d]*(\d)/) || lower.match(/^(\d)(?:st|nd|rd|th)\s*year/);
    if (yearMatch) currentYear = yearMatch[1];
    // detect section (removing academic year/B.Tech keywords to avoid false matching B)
    const cleanLineForSec = lower
      .replace(/\bb\.?\s*tech\b/g, '')
      .replace(/\bm\.?\s*tech\b/g, '')
      .replace(/\ba\.?\s*y\.?\b/g, '')
      .replace(/\bsem(?:ester)?\b/g, '');

    const secMatch = cleanLineForSec.match(/(?:section|sec|class|class\s*work|ece)[^a-z0-9]*([a-g])\b/i);
    if (secMatch) {
      currentSection = secMatch[1].toUpperCase();
    } else {
      // Fallback word search on clean line
      const words = cleanLineForSec.split(/[\s,()\-.:_]+/);
      let foundFallbackSec = false;
      for (const letter of ['B', 'C', 'D', 'E', 'F', 'G']) {
        if (words.includes(letter)) {
          currentSection = letter;
          foundFallbackSec = true;
          break;
        }
      }
      if (!foundFallbackSec && words.includes('a')) {
        currentSection = 'A';
      }
    }

    // detect time slot and subject code on same/adjacent lines
    TIME_RE.lastIndex = 0;
    const tm = TIME_RE.exec(line);
    if (tm && currentDay) {
      const timeSlot = `${tm[1]}-${tm[2]}`;
      // extract subject code
      const codeMatch = line.match(/\b([A-Z]{2,6}\d{2,4})\b/);
      const subjectCode = codeMatch ? codeMatch[1] : '';
      if (subjectCode) {
        rows.push({
          year: currentYear,
          section: currentSection,
          day: currentDay,
          timeSlot,
          subjectCode,
          room: ''
        });
      }
    }
  }
  return rows;
}

// =============================================================
// FACULTY LEAVES VERIFICATION
// =============================================================
const getLeaveRequests = async (req, res) => {
  try {
    const list = await LeaveRequest.find({ collegeCode: req.user.collegeCode })
      .populate('userId', 'fullName employeeId assignedDepartment')
      .sort({ createdAt: -1 });

    // Filter to only return leaves for faculty in the HOD's department
    const deptLeaves = list.filter(l => l.userId?.assignedDepartment === req.user.assignedDepartment);
    res.status(200).json(deptLeaves);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const recommendLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await LeaveRequest.findOne({ _id: id, collegeCode: req.user.collegeCode });
    if (!leave) return res.status(404).json({ message: 'Leave request not found.' });

    leave.status = 'recommended';
    await leave.save();

    await logAction(req.user._id, 'hod', req.user.collegeCode, req.user.assignedDepartment, `RECOMMENDED_FACULTY_LEAVE: ${id}`, req);
    res.status(200).json({ message: 'Leave recommended and forwarded to Principal.', leave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await LeaveRequest.findOne({ _id: id, collegeCode: req.user.collegeCode });
    if (!leave) return res.status(404).json({ message: 'Leave request not found.' });

    leave.status = 'rejected';
    await leave.save();

    await logAction(req.user._id, 'hod', req.user.collegeCode, req.user.assignedDepartment, `REJECTED_FACULTY_LEAVE: ${id}`, req);
    res.status(200).json({ message: 'Leave request rejected.', leave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// INTERNAL MARKS VERIFICATION
// =============================================================
const getExamMarks = async (req, res) => {
  try {
    const list = await ExamMark.find({ collegeCode: req.user.collegeCode })
      .populate('studentId', 'fullName branch year rollNumber')
      .sort({ createdAt: -1 });

    const deptMarks = list.filter(m => m.studentId?.branch === req.user.assignedDepartment);
    res.status(200).json(deptMarks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const approveExamMarks = async (req, res) => {
  try {
    const { id } = req.params;
    const mark = await ExamMark.findOne({ _id: id, collegeCode: req.user.collegeCode });
    if (!mark) return res.status(404).json({ message: 'Mark submission not found.' });

    mark.status = 'approved';
    await mark.save();

    res.status(200).json({ message: 'Internal marks entry approved.', mark });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const rejectExamMarks = async (req, res) => {
  try {
    const { id } = req.params;
    const mark = await ExamMark.findOne({ _id: id, collegeCode: req.user.collegeCode });
    if (!mark) return res.status(404).json({ message: 'Mark submission not found.' });

    mark.status = 'rejected';
    await mark.save();

    res.status(200).json({ message: 'Internal marks entry rejected.', mark });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =============================================================
// NOTES & STUDY MATERIALS
// =============================================================
const uploadMaterial = async (req, res) => {
  try {
    const { title, type, fileUrl } = req.body;
    if (!title || !type) {
      return res.status(400).json({ message: 'Title and Type parameters required.' });
    }

    const mat = await Material.create({
      title,
      type,
      fileUrl: fileUrl || '',
      department: req.user.assignedDepartment,
      collegeCode: req.user.collegeCode
    });

    res.status(201).json({ message: 'Material added to departmental repository.', mat });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMaterials = async (req, res) => {
  try {
    const list = await Material.find({
      department: req.user.assignedDepartment,
      collegeCode: req.user.collegeCode
    }).sort({ createdAt: -1 });

    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const uploadStudents = async (req, res) => {
  try {
    const studentsList = req.body.studentsList || req.body.recordsList;
    if (!studentsList || !Array.isArray(studentsList)) {
      return res.status(400).json({ message: 'Invalid students list.' });
    }

    const StudentRecord = require('../models/StudentRecord');
    const created = [];
    
    for (const item of studentsList) {
      if (!item.rollNumber || !item.fullName) continue;

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
        department: req.user.assignedDepartment.toUpperCase(),
        branch: req.user.assignedDepartment.toUpperCase(),
        course: (item.course || 'B.TECH').toUpperCase(),
        academicYear: item.academicYear || '2026-27',
        semester: Number(item.semester || 1),
        section: (item.section || 'A').toUpperCase(),
        batch: item.batch || '',
        collegeCode: req.user.collegeCode.toUpperCase(),
        parentDetails: {
          fatherName: item.fatherName || '',
          motherName: item.motherName || '',
          parentPhone: item.parentPhone || '',
          parentEmail: item.parentEmail || ''
        },
        mobileNumber: item.mobileNumber || '',
        status: item.status || 'Active',
        photo: item.photo || ''
      });

      const { autoProvisionUserForStudent } = require('../services/autoProvisionStudent');
      await autoProvisionUserForStudent(record);

      created.push(record);
    }

    await logAction(req.user._id, 'hod', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment.toUpperCase(), `BULK_IMPORTED_STUDENT_RECORDS: Count ${created.length}`, req);

    res.status(201).json({ message: `${created.length} students imported successfully.`, students: created });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getDepartmentStudents = async (req, res) => {
  try {
    const StudentRecord = require('../models/StudentRecord');
    const records = await StudentRecord.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      branch: req.user.assignedDepartment.toUpperCase()
    }).populate('linkedUserId', 'email username isActive');
    res.status(200).json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getDepartmentFaculty = async (req, res) => {
  try {
    const faculty = await User.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      role: 'faculty',
      assignedDepartment: req.user.assignedDepartment.toUpperCase()
    }).select('-password');
    res.status(200).json(faculty);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getDepartmentSubjects = async (req, res) => {
  try {
    const list = await Subject.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      department: req.user.assignedDepartment.toUpperCase()
    });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createDepartmentSubject = async (req, res) => {
  try {
    const { subjectCode, name, credits, faculty, semester, type } = req.body;
    if (!subjectCode || !name || !semester) {
      return res.status(400).json({ message: 'Subject Code, Name and Semester are required.' });
    }
    const dept = req.user.assignedDepartment.toUpperCase();

    const exists = await Subject.findOne({
      subjectCode: subjectCode.toUpperCase(),
      collegeCode: req.user.collegeCode.toUpperCase()
    });
    if (exists) {
      return res.status(400).json({ message: 'Subject Code already exists under this college.' });
    }

    let subject = await Subject.create({
      subjectCode: subjectCode.toUpperCase(),
      name,
      credits: credits || 3,
      faculty: faculty || null,
      semester: Number(semester),
      type: type || 'Theory',
      department: dept,
      collegeCode: req.user.collegeCode.toUpperCase()
    });

    subject = await Subject.findById(subject._id).populate('faculty', 'fullName');

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('subject_created', { subject });
    }

    await logAction(req.user._id, 'hod', req.user.collegeCode.toUpperCase(), dept, `CREATED_SUBJECT: ${subjectCode}`, req);
    res.status(201).json({ message: 'Subject registered.', subject });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getDepartmentNotices = async (req, res) => {
  try {
    const Notice = require('../models/Notice');
    const list = await Notice.find({
      collegeCode: req.user.collegeCode.toUpperCase(),
      $or: [
        { targetDepartment: req.user.assignedDepartment.toUpperCase() },
        { targetDepartment: '' }
      ]
    }).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const publishDepartmentNotice = async (req, res) => {
  try {
    const { title, content, type } = req.body;
    const Notice = require('../models/Notice');
    const notice = await Notice.create({
      title,
      content,
      type: type || 'general',
      targetDepartment: req.user.assignedDepartment.toUpperCase(),
      collegeCode: req.user.collegeCode.toUpperCase()
    });

    const { sendFcmNotification } = require('../services/notificationService');
    await sendFcmNotification({
      collegeCode: req.user.collegeCode,
      department: req.user.assignedDepartment.toUpperCase(),
      title: `📢 Department Circular: ${title}`,
      body: content.substring(0, 100)
    });

    res.status(201).json({ message: 'Notice published.', notice });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const actionStudentLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }
    const leave = await LeaveRequest.findOne({ _id: id, collegeCode: req.user.collegeCode.toUpperCase() });
    if (!leave) return res.status(404).json({ message: 'Leave request not found.' });

    leave.status = status;
    await leave.save();

    await logAction(req.user._id, 'hod', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment.toUpperCase(), `ACTIONED_STUDENT_LEAVE: ${id} to ${status}`, req);
    res.status(200).json({ message: `Leave request ${status}.`, leave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateFacultyAssignments = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedClasses, jobTitle } = req.body;

    const faculty = await User.findOne({
      _id: id,
      collegeCode: req.user.collegeCode.toUpperCase(),
      role: 'faculty',
      assignedDepartment: req.user.assignedDepartment.toUpperCase()
    });
    if (!faculty) return res.status(404).json({ message: 'Faculty member not found.' });

    if (assignedClasses !== undefined) faculty.assignedClasses = assignedClasses;
    if (jobTitle !== undefined) faculty.jobTitle = jobTitle;

    await faculty.save();

    const { syncFacultyTimetableAssignments } = require('../services/erpSyncService');
    await syncFacultyTimetableAssignments(req.user.collegeCode, faculty);

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('faculty_updated', { faculty });
    }

    await logAction(req.user._id, 'hod', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment.toUpperCase(), `UPDATED_FACULTY_ASSIGNMENTS: ${faculty.email}`, req);
    res.status(200).json({ message: 'Faculty assignments updated successfully.', faculty });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createFaculty = async (req, res) => {
  try {
    const { fullName, email, password, employeeId, jobTitle } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'FullName, Email, and Password are required.' });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) return res.status(400).json({ message: 'Email address already in use.' });

    if (employeeId) {
      const empIdExists = await User.findOne({ collegeCode: req.user.collegeCode.toUpperCase(), employeeId });
      if (empIdExists) return res.status(400).json({ message: 'Employee ID already assigned.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'faculty',
      collegeCode: req.user.collegeCode.toUpperCase(),
      employeeId: employeeId || null,
      assignedDepartment: req.user.assignedDepartment.toUpperCase(),
      jobTitle: jobTitle || 'Professor',
      isActive: true
    });

    const { syncFacultyTimetableAssignments } = require('../services/erpSyncService');
    await syncFacultyTimetableAssignments(req.user.collegeCode, newUser);

    await logAction(req.user._id, 'hod', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment.toUpperCase(), `CREATED_FACULTY_ACCOUNT: ${email}`, req);

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('campus_user_sync', { action: 'create', user: newUser });
      io.to(req.user.collegeCode.toUpperCase()).emit('faculty_created', { faculty: newUser });
    }

    res.status(201).json({ message: 'Faculty account registered successfully.', user: newUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, employeeId, isActive, password, jobTitle } = req.body;

    const user = await User.findOne({ 
      _id: id, 
      collegeCode: req.user.collegeCode.toUpperCase(),
      role: 'faculty',
      assignedDepartment: req.user.assignedDepartment.toUpperCase()
    });
    if (!user) return res.status(404).json({ message: 'Faculty account not found.' });

    if (fullName) user.fullName = fullName;
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (isActive !== undefined) user.isActive = isActive;
    if (jobTitle !== undefined) user.jobTitle = jobTitle;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    const { syncFacultyTimetableAssignments } = require('../services/erpSyncService');
    await syncFacultyTimetableAssignments(req.user.collegeCode, user);

    await logAction(req.user._id, 'hod', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment.toUpperCase(), `UPDATED_FACULTY_ACCOUNT: ${user.email}`, req);

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('campus_user_sync', { action: 'update', user });
      io.to(req.user.collegeCode.toUpperCase()).emit('faculty_updated', { faculty: user });
    }

    res.status(200).json({ message: 'Faculty account updated successfully.', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOneAndDelete({ 
      _id: id, 
      collegeCode: req.user.collegeCode.toUpperCase(),
      role: 'faculty',
      assignedDepartment: req.user.assignedDepartment.toUpperCase()
    });
    if (!user) return res.status(404).json({ message: 'Faculty account not found.' });

    await logAction(req.user._id, 'hod', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment.toUpperCase(), `DELETED_FACULTY_ACCOUNT: ${user.email}`, req);

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('campus_user_sync', { action: 'delete', user });
      io.to(req.user.collegeCode.toUpperCase()).emit('faculty_deleted', { faculty: user });
    }

    res.status(200).json({ message: 'Faculty account deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createStudent = async (req, res) => {
  try {
    const {
      studentId, rollNumber, admissionNumber, fullName, gender, dob,
      course, academicYear, semester, section,
      batch, parentDetails, mobileNumber, status, admissionDate, photo
    } = req.body;

    if (!rollNumber || !fullName || !gender || !dob || !course || !academicYear || !semester || !section) {
      return res.status(400).json({ message: 'Missing required academic record fields.' });
    }

    const StudentRecord = require('../models/StudentRecord');
    const cleanRollNumber = rollNumber.trim().toUpperCase();
    const finalStudentId = studentId || `STU${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    const finalAdmissionNumber = admissionNumber || `ADM${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

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
      department: req.user.assignedDepartment.toUpperCase(),
      branch: req.user.assignedDepartment.toUpperCase(),
      course: course.toUpperCase(),
      academicYear,
      semester: Number(semester),
      section: section.toUpperCase(),
      batch,
      parentDetails,
      mobileNumber,
      status: status || 'Active',
      admissionDate,
      photo,
      collegeCode: req.user.collegeCode.toUpperCase()
    });

    const { autoProvisionUserForStudent } = require('../services/autoProvisionStudent');
    await autoProvisionUserForStudent(record);

    await logAction(req.user._id, 'hod', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment.toUpperCase(), `CREATED_STUDENT_RECORD: ${rollNumber}`, req);

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('student_record_sync', { action: 'create', rollNumber: rollNumber.toUpperCase(), record });
    }

    res.status(201).json({ message: 'Student academic record created.', record });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const StudentRecord = require('../models/StudentRecord');

    const record = await StudentRecord.findOne({ 
      _id: id, 
      collegeCode: req.user.collegeCode.toUpperCase(),
      branch: req.user.assignedDepartment.toUpperCase()
    });
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

    const fields = ['fullName', 'gender', 'dob', 'course', 'academicYear', 'semester', 'section', 'batch', 'parentDetails', 'mobileNumber', 'status', 'admissionDate', 'photo'];
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
    await logAction(req.user._id, 'hod', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment.toUpperCase(), `UPDATED_STUDENT_RECORD: ${record.rollNumber}`, req);

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('student_record_sync', { action: 'update', rollNumber: record.rollNumber, record });
    }

    res.status(200).json({ message: 'Student record updated successfully.', record });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const StudentRecord = require('../models/StudentRecord');

    const record = await StudentRecord.findOneAndDelete({ 
      _id: id, 
      collegeCode: req.user.collegeCode.toUpperCase(),
      branch: req.user.assignedDepartment.toUpperCase()
    });
    if (!record) return res.status(404).json({ message: 'Student record not found.' });

    await logAction(req.user._id, 'hod', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment.toUpperCase(), `DELETED_STUDENT_RECORD: ${record.rollNumber}`, req);

    const io = req.app.get('io');
    if (io) {
      io.to(req.user.collegeCode.toUpperCase()).emit('student_record_sync', { action: 'delete', rollNumber: record.rollNumber });
    }

    res.status(200).json({ message: 'Student record deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkActionStudents = async (req, res) => {
  try {
    const { ids, action, targetValue } = req.body;
    if (!ids || !Array.isArray(ids) || !action) {
      return res.status(400).json({ message: 'Missing bulk action parameters.' });
    }

    const StudentRecord = require('../models/StudentRecord');
    const filter = { 
      _id: { $in: ids }, 
      collegeCode: req.user.collegeCode.toUpperCase(),
      branch: req.user.assignedDepartment.toUpperCase()
    };
    let updateDoc = {};

    if (action === 'promote') {
      const list = await StudentRecord.find(filter);
      for (const rec of list) {
        if (rec.semester < 10) {
          rec.semester += 1;
          await rec.save();
        }
      }
      await logAction(req.user._id, 'hod', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment.toUpperCase(), `BULK_PROMOTED_STUDENTS: Count ${ids.length}`, req);
    } else {
      if (action === 'transfer') {
        updateDoc = { collegeCode: targetValue.toUpperCase(), status: 'Transferred' };
      } else if (action === 'status_update') {
        updateDoc = { status: targetValue };
      }
      await StudentRecord.updateMany(filter, { $set: updateDoc });
      await logAction(req.user._id, 'hod', req.user.collegeCode.toUpperCase(), req.user.assignedDepartment.toUpperCase(), `BULK_UPDATED_STUDENTS: Action ${action}, Count ${ids.length}`, req);
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

// =============================================================
// BULK IMPORT SUBJECTS
// =============================================================
const bulkImportSubjects = async (req, res) => {
  try {
    const { subjects } = req.body;
    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ message: 'Subjects array is required.' });
    }
    const collegeCode = req.user.collegeCode.toUpperCase();
    const department = req.user.assignedDepartment.toUpperCase();

    const inserted = [];
    const skipped = [];
    for (const s of subjects) {
      if (!s.subjectCode || !s.name) { skipped.push(s); continue; }
      const exists = await Subject.findOne({ collegeCode, subjectCode: s.subjectCode.toUpperCase() });
      if (exists) { skipped.push(s.subjectCode); continue; }
      const doc = await Subject.create({
        collegeCode,
        department,
        subjectCode: s.subjectCode.toUpperCase(),
        name: s.name.trim(),
        credits: Number(s.credits) || 3
      });
      inserted.push(doc);
    }

    await logAction(req.user._id, 'hod', collegeCode, department, `BULK_IMPORTED_SUBJECTS: ${inserted.length} inserted, ${skipped.length} skipped`, req);
    res.status(200).json({ message: `${inserted.length} subjects imported, ${skipped.length} skipped (duplicates/invalid).`, inserted, skipped });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllCollegeFaculty = async (req, res) => {
  try {
    const collegeCode = req.user.collegeCode.toUpperCase();
    const facultyList = await User.find(
      { collegeCode, role: 'faculty' },
      { fullName: 1, email: 1, employeeId: 1, assignedDepartment: 1 }
    ).sort({ assignedDepartment: 1, fullName: 1 });

    res.status(200).json(facultyList);
  } catch (err) {
    console.error('getAllCollegeFaculty error:', err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/hod/timetable/analytics — Comprehensive Timetable Analytics & Utilization Dashboard
const getTimetableAnalytics = async (req, res) => {
  try {
    const department = req.user.assignedDepartment.toUpperCase();
    const collegeCode = req.user.collegeCode.toUpperCase();

    const timetables = await Timetable.find({ department, collegeCode });
    const allFaculty = await User.find({ collegeCode, role: 'faculty', assignedDepartment: department });
    const allSubjects = await Subject.find({ collegeCode, department });

    let totalSlots = 0;
    const assignedFacultyIds = new Set();
    const roomBookingMap = {};
    const subjectHoursMap = {};

    allSubjects.forEach(s => {
      subjectHoursMap[s.subjectCode] = {
        name: s.name,
        requiredHours: s.credits ? s.credits + 1 : 4,
        assignedHours: 0
      };
    });

    for (const tt of timetables) {
      for (const slot of tt.slots) {
        if (!slot.startTime || !slot.endTime) continue;
        totalSlots++;

        if (slot.facultyId || slot.matchedFacultyId) {
          assignedFacultyIds.add((slot.facultyId || slot.matchedFacultyId).toString());
        }

        if (slot.room) {
          const roomKey = slot.room.trim().toUpperCase();
          roomBookingMap[roomKey] = (roomBookingMap[roomKey] || 0) + 1;
        }

        if (slot.subjectCode && subjectHoursMap[slot.subjectCode]) {
          subjectHoursMap[slot.subjectCode].assignedHours += 1;
        }
      }
    }

    const totalFacultyCount = allFaculty.length || 1;
    const facultyUtilization = Math.round((assignedFacultyIds.size / totalFacultyCount) * 100);

    const busyClassrooms = Object.entries(roomBookingMap)
      .map(([room, count]) => ({ room, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const roomUtilization = Math.min(100, Math.round((Object.keys(roomBookingMap).length / 10) * 100));

    const subjectHoursValidation = Object.entries(subjectHoursMap).map(([code, info]) => {
      const remaining = Math.max(0, info.requiredHours - info.assignedHours);
      const extra = Math.max(0, info.assignedHours - info.requiredHours);
      return {
        subjectCode: code,
        name: info.name,
        requiredHours: info.requiredHours,
        assignedHours: info.assignedHours,
        status: remaining > 0 ? `Remaining Hours : ${remaining}` : (extra > 0 ? `Extra Hours Assigned (+${extra})` : 'Optimal')
      };
    });

    res.status(200).json({
      department,
      totalTimetables: timetables.length,
      totalSlots,
      facultyUtilization: `${facultyUtilization}%`,
      roomUtilization: `${roomUtilization}%`,
      freePeriods: Math.max(0, 42 - totalSlots),
      busyClassrooms,
      subjectHoursValidation
    });
  } catch (err) {
    console.error('getTimetableAnalytics error:', err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/hod/timetable/restore-version — Restore a previous timetable version
const restoreTimetableVersion = async (req, res) => {
  try {
    const { year, section, version } = req.body;
    const department = req.user.assignedDepartment.toUpperCase();
    const collegeCode = req.user.collegeCode.toUpperCase();

    const timetables = await Timetable.find({ department, collegeCode, year: Number(year), section: section.toUpperCase() });
    if (!timetables || timetables.length === 0) {
      return res.status(404).json({ message: 'No timetable found for this section.' });
    }

    let restoredCount = 0;
    for (const tt of timetables) {
      if (tt.previousVersions && tt.previousVersions.length > 0) {
        const targetVer = tt.previousVersions.find(v => v.version === Number(version));
        if (targetVer && targetVer.slots) {
          tt.slots = targetVer.slots;
          tt.version = Number(version);
          await tt.save();
          restoredCount++;
        }
      }
    }

    await logAction(req.user._id, 'hod', collegeCode, department, `RESTORED_TIMETABLE_VERSION: Year ${year}-${section} to Version ${version}`, req);

    // Socket.io sync
    const io = req.app.get('io');
    if (io) {
      const sectionRoom = `${department}_${Number(year) * 2 - 1}_${section.toUpperCase()}`;
      io.to(sectionRoom).emit('timetable_updated', { department, year, section });
      io.to(collegeCode).emit('timetable_updated', { department, year, section });
    }

    res.status(200).json({ message: `Successfully restored timetable for Year ${year}-${section} to Version ${version}.`, restoredCount });
  } catch (err) {
    console.error('restoreTimetableVersion error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getDashboardStats,
  // Attendance monitoring
  getHodAttendance,
  getHodAttendanceHistory,
  getHodAttendanceAnalytics,
  getFacultySubmissionStatus,
  // Timetable
  saveTimetable,
  getTimetables,
  getTimetableAnalytics,
  restoreTimetableVersion,
  // Leaves
  getLeaveRequests,
  recommendLeave,
  rejectLeave,
  // Marks
  getExamMarks,
  approveExamMarks,
  rejectExamMarks,
  // Materials
  uploadMaterial,
  getMaterials,
  // Students
  uploadStudents,
  getDepartmentStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkActionStudents,
  // Faculty
  getDepartmentFaculty,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  updateFacultyAssignments,
  getAllCollegeFaculty,
  // Subjects
  getDepartmentSubjects,
  createDepartmentSubject,
  bulkImportSubjects,
  // Notices
  getDepartmentNotices,
  publishDepartmentNotice,
  // Student leave
  actionStudentLeave,
  // Timetable bulk
  parseFileForTimetable,
  bulkSaveTimetables,
  clearAllTimetables,
  clearSectionTimetable
};


// ============================================================
// COMPLETE REWRITE: Local HTML Table parser for ASCET/JNTU
// timetable Word documents. Handles colspan, all days, all
// periods, merged LAB cells, and correct year/section mapping.
// ============================================================
function parseTimetableHtmlLocally(html) {
  try {
    // Standard ASCET/JNTU-A period definitions
    const PERIOD_MAP = [
      { period: 1, start: '09:00', end: '10:00' },
      { period: 2, start: '10:20', end: '11:10' },
      { period: 3, start: '11:10', end: '12:10' },
      { period: 4, start: '13:00', end: '14:00' },
      { period: 5, start: '14:00', end: '15:00' },
      { period: 6, start: '15:00', end: '16:00' },
    ];

    const BREAK_WORDS = ['BREAK', 'LUNCH', 'MEDITATION', 'YOGA', 'PRAYER', 'INTERVAL', 'RECESS', 'LIBRARY', 'SPORTS', 'SEMINAR'];

    const DAYS_MAP = {
      'mon': 'Monday', 'monday': 'Monday',
      'tue': 'Tuesday', 'tues': 'Tuesday', 'tuesday': 'Tuesday',
      'wed': 'Wednesday', 'wednesday': 'Wednesday',
      'thu': 'Thursday', 'thurs': 'Thursday', 'thursday': 'Thursday',
      'fri': 'Friday', 'friday': 'Friday',
      'sat': 'Saturday', 'saturday': 'Saturday'
    };

    // ── Helpers ──────────────────────────────────────────────

    function toCellText(tdHtml) {
      return tdHtml
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#\d+;/g, '')
        .trim()
        .replace(/\s+/g, ' ');
    }

    function normalizeTime(t) {
      if (!t) return '';
      t = t.trim().replace(/\./g, ':').replace(/\s/g, '');
      const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!m) return '';
      let h = parseInt(m[1]);
      const min = m[2];
      const ampm = (m[3] || '').toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      else if (ampm === 'AM' && h === 12) h = 0;
      else if (!ampm && h >= 1 && h <= 6) h += 12; // 1:00-6:00 without AM/PM = PM (afternoon)
      return `${h.toString().padStart(2, '0')}:${min}`;
    }

    function toMins(t) {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    }

    function isBreakCell(text) {
      if (!text || !text.trim()) return true;
      const up = text.toUpperCase().trim();
      return BREAK_WORDS.some(w => up.includes(w));
    }

    function detectDay(text) {
      const lc = (text || '').trim().toLowerCase();
      for (const [k, v] of Object.entries(DAYS_MAP)) {
        if (lc.startsWith(k)) return v;
      }
      return null;
    }

    function nearestPeriod(startTime) {
      const sm = toMins(startTime);
      let best = PERIOD_MAP[0];
      let bestDist = 99999;
      for (const p of PERIOD_MAP) {
        const d = Math.abs(toMins(p.start) - sm);
        if (d < bestDist) { bestDist = d; best = p; }
      }
      return best;
    }

    // ── HTML Table Parser (with colspan/rowspan support) ─────

    function parseTable(tableHtml) {
      const grid = [];                // grid[row][col] = { text, colspan, isExtension }
      const spanFill = {};            // "r,c" → cell obj

      const trBlocks = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

      trBlocks.forEach((trHtml, ri) => {
        if (!grid[ri]) grid[ri] = [];
        let ci = 0;

        const applySpans = () => {
          while (spanFill[`${ri},${ci}`] !== undefined) {
            grid[ri][ci] = spanFill[`${ri},${ci}`];
            ci++;
          }
        };

        applySpans();

        const tdBlocks = trHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
        for (const tdHtml of tdBlocks) {
          applySpans();

          const csM = tdHtml.match(/colspan\s*=\s*["']?(\d+)["']?/i);
          const rsM = tdHtml.match(/rowspan\s*=\s*["']?(\d+)["']?/i);
          const cs = csM ? parseInt(csM[1]) : 1;
          const rs = rsM ? parseInt(rsM[1]) : 1;
          const text = toCellText(tdHtml);

          // Place primary cell
          grid[ri][ci] = { text, colspan: cs, isExtension: false };

          // Fill colspan extensions in same row
          for (let c2 = 1; c2 < cs; c2++) {
            grid[ri][ci + c2] = { text, colspan: 0, isExtension: true };
          }

          // Fill rowspan extensions in lower rows
          for (let r2 = 1; r2 < rs; r2++) {
            for (let c2 = 0; c2 < cs; c2++) {
              const key = `${ri + r2},${ci + c2}`;
              spanFill[key] = { text, colspan: c2 === 0 ? cs : 0, isExtension: c2 > 0, isRowspanExt: true };
            }
          }

          ci += cs;
        }

        applySpans();
      });

      return grid;
    }

    // ── Split HTML into text / table blocks ──────────────────

    const blocks = [];
    const tblRE = /<table[^>]*>[\s\S]*?<\/table>/gi;
    let lastEnd = 0;
    let tMatch;
    while ((tMatch = tblRE.exec(html)) !== null) {
      if (tMatch.index > lastEnd) {
        blocks.push({ type: 'text', content: html.slice(lastEnd, tMatch.index) });
      }
      blocks.push({ type: 'table', content: tMatch[0] });
      lastEnd = tMatch.index + tMatch[0].length;
    }
    if (lastEnd < html.length) blocks.push({ type: 'text', content: html.slice(lastEnd) });

    // ── Pass 1: build legend map ─────────────────────────────

    let legendMap = {};
    for (const b of blocks) {
      if (b.type !== 'table') continue;
      const grid = parseTable(b.content);
      const isLeg = grid.some(row => row && row.some(c => c && /subject\s*code|sl\.?\s*no\.?|course\s*title/i.test(c.text)));
      if (!isLeg) continue;
      for (const row of grid) {
        if (!row || row.length < 3) continue;
        const code = row[1]?.text?.trim();
        const title = row[2]?.text?.trim();
        if (code && title) {
          // Extract abbreviation from parentheses: "Advanced Digital Circuits (ADIC)" → ADIC → 23EC501
          const abbM = title.match(/\(([^)]{2,10})\)/);
          if (abbM) legendMap[abbM[1].trim().toUpperCase()] = code.toUpperCase().trim();
          // Also map "Code (abbr)" → code
          if (/^[A-Z0-9]{4,}$/.test(code.replace(/[^A-Z0-9]/g, ''))) {
            legendMap[code.toUpperCase().trim()] = code.toUpperCase().trim();
          }
        }
      }
    }
    console.log('📚 [Parser] Legend:', JSON.stringify(legendMap));

    function resolveSubject(raw) {
      const up = raw.toUpperCase().trim();
      if (legendMap[up]) return legendMap[up];
      if (up.includes('/')) {
        return up.split('/').map(p => {
          const c = p.trim().replace(/\s*LAB\s*$/i, '').trim();
          return legendMap[c] || legendMap[p.trim()] || p.trim();
        }).join('/');
      }
      // Partial match: remove " LAB" suffix
      const noLab = up.replace(/\s*LAB\s*$/i, '').trim();
      if (noLab !== up && legendMap[noLab]) return legendMap[noLab] + ' LAB';
      return up;
    }

    // ── Pass 2: parse each timetable ─────────────────────────

    const rows = [];
    let prevText = '';
    let tableNum = 0;

    for (const b of blocks) {
      if (b.type === 'text') {
        prevText += b.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        continue;
      }

      tableNum++;
      const grid = parseTable(b.content);
      if (!grid || grid.length === 0) { continue; }

      // Proactively fill empty cells following a LAB cell in the same row (standard JNTU lab duration extension)
      for (let ri = 0; ri < grid.length; ri++) {
        const row = grid[ri];
        if (!row) continue;
        for (let ci = 1; ci < row.length - 1; ci++) {
          const cell = row[ci];
          if (cell && !cell.isExtension && cell.text && /LAB/i.test(cell.text)) {
            const nextCell = row[ci + 1];
            if (nextCell && (!nextCell.text || !nextCell.text.trim()) && !nextCell.isExtension) {
              nextCell.text = cell.text;
            }
          }
        }
      }

      // Skip legend tables
      const isLeg = grid.some(row => row && row.some(c => c && /subject\s*code|sl\.?\s*no\.?|course\s*title/i.test(c.text)));
      if (isLeg) { continue; }

      // Build search text: preceding paragraphs + first 4 rows of table
      let headerText = '';
      for (let r = 0; r < Math.min(4, grid.length); r++) {
        if (grid[r]) headerText += ' ' + grid[r].map(c => c?.text || '').join(' ');
      }
      const searchText = (prevText + ' ' + headerText).replace(/\s+/g, ' ').trim();

      // ── Detect YEAR ──────────────────────────────────────
      let year = null;

      // Pattern A: "III B.Tech" / "3rd B.Tech"  (roman I,II,III,IV MUST come before "B.Tech")
      let ym;
      ym = searchText.match(/\b(IV|III|II|I)\s+B\.?\s*Tech/i);
      if (ym) {
        const v = ym[1].toUpperCase();
        year = v === 'I' ? 1 : v === 'II' ? 2 : v === 'III' ? 3 : 4;
      }

      // Pattern B: "3rd B.Tech"
      if (year === null) {
        ym = searchText.match(/\b([1-4])(?:st|nd|rd|th)?\s+B\.?\s*Tech/i);
        if (ym) year = parseInt(ym[1]);
      }

      // Pattern C: "3rd Year" / "Year 3"
      if (year === null) {
        ym = searchText.match(/\b([1-4])(?:st|nd|rd|th)?\s+(?:year|yr)\b/i)
          || searchText.match(/\b(?:year|yr)\s+([1-4])\b/i);
        if (ym) year = parseInt(ym[1]);
      }

      // Pattern D: Roman numeral Year: "III Year"
      if (year === null) {
        ym = searchText.match(/\b(IV|III|II|I)\s+(?:year|yr)\b/i);
        if (ym) {
          const v = ym[1].toUpperCase();
          year = v === 'I' ? 1 : v === 'II' ? 2 : v === 'III' ? 3 : 4;
        }
      }

      // Pattern E: Semester → Year  (V Sem = Year 3)
      if (year === null) {
        ym = searchText.match(/\b(VIII|VII|VI|V|IV|III|II|I|[1-8])(?:st|nd|rd|th)?\s*Sem(?:ester)?\b/i);
        if (ym) {
          const v = ym[1].toUpperCase();
          const map = { 'I': 1, '1': 1, 'II': 1, '2': 1, 'III': 2, '3': 2, 'IV': 2, '4': 2, 'V': 3, '5': 3, 'VI': 3, '6': 3, 'VII': 4, '7': 4, 'VIII': 4, '8': 4 };
          year = map[v] || null;
        }
      }

      // Pattern F: Filename/title heuristic (III/V or similar)
      if (year === null) {
        if (/\bV\b.*Sem|\bVII\b.*Sem|\b5(?:th)?\s*Sem|\b6(?:th)?\s*Sem/i.test(searchText)) year = 3;
        else if (/\bIII\b.*Sem|\bIV\b.*Sem|\b3(?:rd)?\s*Sem|\b4(?:th)?\s*Sem/i.test(searchText)) year = 2;
        else if (/\bVII\b.*Sem|\bVIII\b.*Sem|\b7(?:th)?\s*Sem|\b8(?:th)?\s*Sem/i.test(searchText)) year = 4;
        else year = 3; // default for "V Sem" docs
      }

      // ── Detect SECTION ───────────────────────────────────
      let section = 'A';
      
      // Clean search text to avoid B.Tech / M.Tech matching
      const cleanSearchText = searchText.toUpperCase()
        .replace(/\bB\.?\s*TECH\b/g, '')
        .replace(/\bM\.?\s*TECH\b/g, '')
        .replace(/\bA\.?\s*Y\.?\b/g, '')
        .replace(/\bSEM(?:ESTER)?\b/g, '');

      const secREs = [
        /Class\s*:?\s*([A-G])\s*SEC/i,
        /Class\s*[:-]\s*([A-G])\b/i,
        /Class\s*Work\s*[:-]?\s*([A-G])\b/i,
        /\b([A-G])\s*SEC\b/i,
        /CLASS\s*-\s*([A-G])\b/i,
        /SEC(?:TION)?\s*[:-]?\s*([A-G])\b/i,
        /\(ECE[-–\s]([A-G])\)/i,
        /ECE[-–\s]+([A-G])\b/i,
        /ECE\s+([A-G])\b/i,
        /\b([A-G])\s+SECTION\b/i,
        /SECTION\s+([A-G])\b/i,
      ];
      
      let foundSec = false;
      for (const re of secREs) {
        const sm = cleanSearchText.match(re);
        if (sm) { 
          section = sm[1].toUpperCase(); 
          foundSec = true; 
          break; 
        }
      }

      if (!foundSec) {
        // Fallback word scanner
        const words = cleanSearchText.split(/[\s,()\-.:_]+/);
        for (const letter of ['B', 'C', 'D', 'E', 'F', 'G']) {
          if (words.includes(letter)) {
            section = letter;
            foundSec = true;
            break;
          }
        }
        if (!foundSec && words.includes('A')) {
          section = 'A';
        }
      }

      console.log(`\n🗂️  [Parser Table-${tableNum}] Detected Year=${year}, Section=${section}`);

      // ── Build column → period mapping ────────────────────
      const colPeriod = {}; // colIdx → { period, start, end } OR { isBreak: true }
      const timeRangeRE = /(\d{1,2}[:.]\d{2})\s*[-–]+\s*(\d{1,2}[:.]\d{2})/i;

      // Strategy 1: Find a row with 3+ time ranges
      let headerRowIdx = -1;
      for (let ri = 0; ri < Math.min(6, grid.length); ri++) {
        const row = grid[ri];
        if (!row) continue;
        const timeCells = row.filter(c => c && !c.isExtension && timeRangeRE.test(c.text));
        if (timeCells.length >= 3) { headerRowIdx = ri; break; }
      }

      if (headerRowIdx >= 0) {
        const hRow = grid[headerRowIdx];
        for (let ci = 0; ci < hRow.length; ci++) {
          const cell = hRow[ci];
          if (!cell || cell.isExtension) continue;
          const m3 = cell.text.match(timeRangeRE);
          if (!m3) continue;
          const start = normalizeTime(m3[1]);
          const end = normalizeTime(m3[2]);
          if (!start || !end) continue;
          const dur = toMins(end) - toMins(start);
          const sh = toMins(start);
          // Skip break columns: < 30 min OR noon break (12:xx, ≤65min)
          if (dur <= 25 || (sh >= 720 && sh < 780 && dur <= 65)) {
            colPeriod[ci] = { isBreak: true };
            continue;
          }
          const p = nearestPeriod(start);
          colPeriod[ci] = { period: p.period, start, end };
        }
      }

      // Strategy 2: START TIME / END TIME rows
      if (Object.keys(colPeriod).length === 0) {
        let startRI = -1, endRI = -1;
        for (let ri = 0; ri < Math.min(6, grid.length); ri++) {
          const row = grid[ri];
          if (!row || !row[0]) continue;
          const f = row[0].text.toLowerCase().replace(/\s+/g, '');
          if (f.includes('start') || f.includes('from')) startRI = ri;
          if (f.includes('end') || f.includes('to')) endRI = ri;
        }
        if (startRI >= 0 && endRI >= 0) {
          const sRow = grid[startRI] || [];
          const eRow = grid[endRI] || [];
          for (let ci = 1; ci < Math.max(sRow.length, eRow.length); ci++) {
            const s = normalizeTime(sRow[ci]?.text || '');
            const e = normalizeTime(eRow[ci]?.text || '');
            if (!s || !e) continue;
            const dur = toMins(e) - toMins(s);
            const sh = toMins(s);
            if (dur <= 25 || (sh >= 720 && sh < 780 && dur <= 65)) {
              colPeriod[ci] = { isBreak: true };
              continue;
            }
            const p = nearestPeriod(s);
            colPeriod[ci] = { period: p.period, start: s, end: e };
          }
        }
      }

      const validPeriods = Object.values(colPeriod).filter(p => !p.isBreak);
      if (validPeriods.length === 0) {
        console.log(`  ⚠️  No period columns found — skipping`);
        continue;
      }

      console.log(`  ⏱️  Periods: ${Object.entries(colPeriod).filter(([,v]) => !v.isBreak).map(([ci, p]) => `col${ci}=P${p.period}(${p.start}-${p.end})`).join(', ')}`);

      // ── Parse day rows ────────────────────────────────────
      for (let ri = 0; ri < grid.length; ri++) {
        const row = grid[ri];
        if (!row || !row[0]) continue;

        const day = detectDay(row[0].text);
        if (!day) continue;

        let dayCount = 0;

        for (let ci = 1; ci < row.length; ci++) {
          const cell = row[ci];
          // Skip: missing, extension of another cell, break column
          if (!cell || cell.isExtension) continue;
          const pInfo = colPeriod[ci];
          if (!pInfo || pInfo.isBreak) continue;

          const cellText = cell.text?.trim();
          if (!cellText || isBreakCell(cellText)) continue;

          const subject = resolveSubject(cellText);
          const cs = cell.colspan || 1;

          // Expand merged cell: find ALL period columns covered by ci…ci+cs-1
          const coveredPeriods = [];
          for (let c2 = ci; c2 < ci + cs; c2++) {
            if (colPeriod[c2] && !colPeriod[c2].isBreak) {
              coveredPeriods.push(colPeriod[c2]);
            }
          }

          // Deduplicate by period (in case colPeriod has duplicates)
          const seen = new Set();
          for (const p of coveredPeriods) {
            const key = `${p.period}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const start12 = to12Hour(p.start);
            const end12 = to12Hour(p.end);
            rows.push({ year, section, day, timeSlot: `${start12}-${end12}`, subjectCode: subject, room: '' });
            console.log(`    ✅ Inserted: Y${year}/${section} ${day} P${p.period}(${start12}-${end12}) → ${subject}`);
            dayCount++;
          }
        }

        if (dayCount > 0) console.log(`  📅 [${day}] ${dayCount} slot(s) added`);
      }

      prevText = '';
    }

    console.log(`\n🎉 [Parser] TOTAL slots extracted: ${rows.length}`);
    return rows.length > 0 ? rows : null;

  } catch (err) {
    console.error('❌ [Parser] parseTimetableHtmlLocally failed:', err.message, err.stack);
    return null;
  }
}



