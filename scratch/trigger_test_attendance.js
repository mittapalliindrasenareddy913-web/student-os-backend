const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Fix Atlas connection on local DNS

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI;

async function postAttendance() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('Connected!');

    // Define schema references inline to avoid path/require conflicts
    const AttendanceSchema = new mongoose.Schema({
      studentId: mongoose.Schema.Types.ObjectId,
      date: Date,
      timeSlot: String,
      subjectCode: String,
      subjectName: String,
      status: String,
      remarks: String,
      department: String,
      facultyId: mongoose.Schema.Types.ObjectId,
      facultyName: String,
      academicYear: String,
      year: Number,
      semester: Number,
      section: String,
      rollNumber: String,
      collegeCode: String
    }, { collection: 'attendances' });

    const NotificationSchema = new mongoose.Schema({
      recipient: mongoose.Schema.Types.ObjectId,
      title: String,
      message: String,
      type: { type: String },
      senderId: mongoose.Schema.Types.ObjectId,
      senderName: String,
      link: String,
      isRead: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    }, { collection: 'notifications' });

    const AuditLogSchema = new mongoose.Schema({
      userId: mongoose.Schema.Types.ObjectId,
      role: String,
      collegeCode: String,
      department: String,
      action: String,
      timestamp: { type: Date, default: Date.now }
    }, { collection: 'auditlogs' });

    const Attendance = mongoose.model('AttendanceTest', AttendanceSchema);
    const Notification = mongoose.model('NotificationTest', NotificationSchema);
    const AuditLog = mongoose.model('AuditLogTest', AuditLogSchema);

    // Params for the test
    const rollNumber = '25G2A04LA2';
    const studentId = new mongoose.Types.ObjectId('6a5993d9468f22379398b952'); // linkedUserId
    const facultyId = new mongoose.Types.ObjectId('5f50c31d102e3b2e5c8c93a0'); // simulated faculty ID
    const collegeCode = 'ASCET001';
    const department = 'ECE';
    const section = 'F';
    const year = 3;
    const semester = 5;
    const subjectCode = 'DSP301';
    const subjectName = 'Digital Signal Processing';
    const facultyName = 'Prof. S. R. Prasad';
    const date = new Date();
    date.setHours(0, 0, 0, 0); // start of today

    console.log(`\nMarking Student ${rollNumber} (ID: ${studentId}) as Present...`);

    // 1. Create or Update Attendance
    const filter = {
      studentId,
      date,
      subjectCode,
      collegeCode
    };

    const patch = {
      timeSlot: '09:00 - 10:00',
      subjectName,
      status: 'Present',
      remarks: 'Verified via Face ID',
      department,
      facultyId,
      facultyName,
      academicYear: '2026-27',
      year,
      semester,
      section,
      rollNumber
    };

    const att = await Attendance.findOneAndUpdate(filter, patch, { upsert: true, new: true });
    console.log('✔ Attendance Record Written in DB:', JSON.stringify(att, null, 2));

    // 2. Create in-app Notification for the student in DB
    const notif = await Notification.create({
      recipient: studentId,
      title: '📋 Attendance Present',
      message: `You were marked Present in ${subjectCode} (${subjectName}) by ${facultyName}`,
      type: 'attendance',
      senderId: facultyId,
      senderName: facultyName,
      link: '/attendance',
      isRead: false
    });
    console.log('✔ In-app Student Notification Created:', JSON.stringify(notif, null, 2));

    // 3. Create HOD & Principal Audit Log in DB
    const log = await AuditLog.create({
      userId: facultyId,
      role: 'faculty',
      collegeCode,
      department,
      action: `REGISTERED_ATTENDANCE: ${subjectCode} Sec ${section} | P:1 A:0 (Student: ${rollNumber})`
    });
    console.log('✔ Audit Log Entry Created for HOD/Principal:', JSON.stringify(log, null, 2));

    console.log('\nSUCCESS: Database states fully updated. Updates will immediately reflect in HOD, Principal, and Student apps!');

  } catch (err) {
    console.error('Error during database update:', err);
  } finally {
    await mongoose.disconnect();
  }
}

postAttendance();
