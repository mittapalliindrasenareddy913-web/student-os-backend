const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const User = require('../models/User');

const formatTo12Hour = (timeStr) => {
  if (!timeStr) return '';
  const clean = timeStr.trim();
  // Check if it's already in 12-hour format with AM/PM
  if (/AM|PM$/i.test(clean)) {
    return clean.toUpperCase();
  }
  const parts = clean.split(':');
  if (parts.length < 2) return clean;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1].substring(0, 2);
  if (isNaN(hour)) return clean;
  
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour.toString().padStart(2, '0')}:${minute} ${ampm}`;
};

const getStudentTimetable = async (req, res) => {
  try {
    const { collegeCode, branch, department, semester, section } = req.user;
    const studentDept = (branch || department || '').toUpperCase().trim();
    const studentSem = Number(semester);
    const studentSec = (section || '').toUpperCase().trim();

    if (!collegeCode || !studentDept || !studentSem || !studentSec) {
      return res.status(200).json([]);
    }

    // Query official timetable documents matching student profile
    const timetables = await Timetable.find({
      collegeCode: collegeCode.toUpperCase(),
      department: studentDept,
      semester: studentSem,
      section: studentSec
    })
    .populate({
      path: 'slots.subjects',
      populate: { path: 'faculty', select: 'fullName' }
    })
    .lean();

    // Transform and map Mongoose slots to clean UI-ready format (no ObjectIds exposed)
    const transformedDays = timetables.map(tt => {
      const slots = (tt.slots || []).map(slot => {
        const hasSubjects = slot.subjects && slot.subjects.length > 0;
        const subject = hasSubjects ? slot.subjects[0] : null;

        const rawTimeSlot = slot.timeSlot || '';
        const rawStart = slot.startTime || rawTimeSlot.split('-')[0] || '';
        const rawEnd = slot.endTime || rawTimeSlot.split('-')[1] || '';

        const startTime = formatTo12Hour(rawStart);
        const endTime = formatTo12Hour(rawEnd);

        return {
          startTime,
          endTime,
          subjectName: subject ? (subject.name || '') : '',
          subjectCode: subject ? (subject.subjectCode || '') : '',
          facultyName: subject ? (subject.faculty?.fullName || '') : (slot.facultyName || ''),
          room: slot.room || '',
          type: slot.type || 'Theory',
          department: tt.department,
          semester: tt.semester,
          section: tt.section
        };
      });

      // Sort slots chronologically
      slots.sort((a, b) => {
        const convertToMin = (t) => {
          if (!t) return 0;
          const ampmMatch = t.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
          if (ampmMatch) {
            let hour = parseInt(ampmMatch[1], 10);
            const min = parseInt(ampmMatch[2], 10);
            const ampm = ampmMatch[3].toUpperCase();
            if (ampm === 'PM' && hour < 12) hour += 12;
            if (ampm === 'AM' && hour === 12) hour = 0;
            return hour * 60 + min;
          }
          const [h, m] = t.split(':').map(Number);
          return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
        };
        return convertToMin(a.startTime) - convertToMin(b.startTime);
      });

      return {
        day: tt.day,
        slots
      };
    });

    res.status(200).json(transformedDays);
  } catch (err) {
    console.error('getStudentTimetable failed error:', err);
    res.status(500).json({ message: 'Internal server error: ' + err.message });
  }
};

module.exports = { getStudentTimetable };
