const bcrypt = require('bcryptjs');
const User = require('../models/User');
const College = require('../models/College');
const StudentRecord = require('../models/StudentRecord');
const Subject = require('../models/Subject');
const apColleges = require('./apCollegesData');

const seedMasterData = async () => {
  try {
    // 1. Seed Super Admin
    const superAdminEmail = 'mittapalliindrasenareddy913@gmail.com';
    let superAdmin = await User.findOne({ role: 'super_admin' });
    if (!superAdmin) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('ISR@MB@d', salt);
      superAdmin = await User.create({
        fullName: 'Indrasena Reddy',
        email: superAdminEmail,
        password: hashedPassword,
        role: 'super_admin',
        collegeCode: '473383',
        employeeId: 'SUPERADMIN001',
        isActive: true
      });
      console.log(`✅ [Seed Master Data] Super Admin created: ${superAdminEmail}`);
    } else if (superAdmin.email !== superAdminEmail) {
      // Update old super admin to new credentials
      const salt = await bcrypt.genSalt(10);
      superAdmin.email = superAdminEmail;
      superAdmin.password = await bcrypt.hash('ISR@MB@d', salt);
      superAdmin.fullName = 'Indrasena Reddy';
      superAdmin.collegeCode = '473383';
      await superAdmin.save();
      console.log(`🔄 [Seed Master Data] Super Admin updated to: ${superAdminEmail}`);
    } else {
      console.log('ℹ️ [Seed Master Data] Super Admin already exists.');
    }

    // 2. Seed Mock Colleges with AISHE values
    const mockColleges = [
      {
        collegeCode: 'ASCET001',
        name: 'Audisankara College of Engineering & Technology',
        address: 'Gudur, SPSR Nellore District',
        university: 'JNTUA',
        state: 'Andhra Pradesh',
        district: 'Nellore',
        departments: ['ECE', 'CSE', 'EEE', 'Civil', 'Mechanical'],
        status: 'active',
        aisheCode: 'C-26895',
        collegeType: 'Autonomous',
        aicteApproved: true,
        ugcApproved: true,
        naacGrade: 'A++',
        nbaAccredited: true,
        verifiedBadge: true
      },
      {
        collegeCode: 'IITB001',
        name: 'Indian Institute of Technology, Bombay',
        address: 'Powai, Mumbai',
        university: 'IIT Bombay',
        state: 'Maharashtra',
        district: 'Mumbai',
        departments: ['CSE', 'EE', 'ME', 'Aero'],
        status: 'active',
        aisheCode: 'C-15792',
        collegeType: 'Government',
        aicteApproved: true,
        ugcApproved: true,
        naacGrade: 'A++',
        nbaAccredited: true,
        verifiedBadge: true
      },
      {
        collegeCode: 'VIT001',
        name: 'Vellore Institute of Technology',
        address: 'Katpadi, Vellore',
        university: 'VIT University',
        state: 'Tamil Nadu',
        district: 'Vellore',
        departments: ['CSE', 'ECE', 'IT', 'BioTech'],
        status: 'pending_verification',
        aisheCode: 'C-98745',
        collegeType: 'Private',
        aicteApproved: true,
        ugcApproved: true,
        naacGrade: 'A+',
        nbaAccredited: true,
        verifiedBadge: false
      }
    ];

    const allCollegesToSeed = [...mockColleges];
    const existingCollegesCount = await College.countDocuments();
    if (existingCollegesCount < 10) {
      for (const apCol of apColleges) {
        if (!allCollegesToSeed.some(c => c.collegeCode === apCol.collegeCode)) {
          allCollegesToSeed.push(apCol);
        }
      }
    }

    for (const data of allCollegesToSeed) {
      const exists = await College.findOne({ collegeCode: data.collegeCode });
      if (!exists) {
        await College.create(data);
        console.log(`✅ [Seed Master Data] Master College seeded: ${data.name} (${data.collegeCode})`);
      } else {
        // Enforce update with AISHE parameters only if changed
        const isChanged = exists.aisheCode !== data.aisheCode ||
                          exists.collegeType !== data.collegeType ||
                          exists.naacGrade !== data.naacGrade ||
                          exists.verifiedBadge !== data.verifiedBadge ||
                          exists.status !== data.status;
        if (isChanged) {
          exists.aisheCode = data.aisheCode;
          exists.collegeType = data.collegeType;
          exists.naacGrade = data.naacGrade;
          exists.verifiedBadge = data.verifiedBadge;
          exists.status = data.status;
          await exists.save();
        }
      }
    }

    // Hash helpers for seeds
    const getHashedPass = async (raw) => {
      const salt = await bcrypt.genSalt(10);
      return bcrypt.hash(raw, salt);
    };

    // Helper to seed users
    const seedUser = async (email, role, rawPassword, fullName, extra = {}) => {
      let u = await User.findOne({ email: email.toLowerCase() });
      if (!u) {
        const hashedPassword = await getHashedPass(rawPassword);
        u = await User.create({
          fullName,
          email: email.toLowerCase(),
          password: hashedPassword,
          role,
          collegeCode: 'ASCET001',
          isActive: true,
          ...extra
        });
        console.log(`✅ [Seed Master Data] Seeded ${role}: ${email} / ${rawPassword}`);
      } else {
        console.log(`ℹ️ [Seed Master Data] User ${email} verified.`);
      }
    };

    // 3. Seed Core Academics
    await seedUser('principal@college.edu', 'principal', 'principal123', 'Principal ASCET', { employeeId: 'PRINCIPAL001' });
    await seedUser('hod@college.edu', 'hod', 'hod123', 'HOD ECE Department', { employeeId: 'ECEHOD001', assignedDepartment: 'ECE' });
    await seedUser('faculty@college.edu', 'faculty', 'faculty123', 'Faculty ECE Department', {
      employeeId: 'ECEFAC023',
      assignedDepartment: 'ECE',
      assignedClasses: [{ year: 3, section: 'F', subject: 'Digital Signal Processing' }]
    });

    // 4. Seed Administration Portal Staff
    await seedUser('coe@college.edu', 'coe', 'coe123', 'Controller of Exams', { employeeId: 'COE001' });
    await seedUser('exam@college.edu', 'exam_cell', 'exam123', 'Exam Cell Officer', { employeeId: 'EXAM001' });
    await seedUser('accounts@college.edu', 'accounts', 'accounts123', 'Accounts Manager', { employeeId: 'ACCT001' });
    await seedUser('library@college.edu', 'library', 'library123', 'Librarian Head', { employeeId: 'LIB001' });
    await seedUser('placement@college.edu', 'placement', 'placement123', 'Placement Officer', { employeeId: 'PLACE001' });
    await seedUser('hostel@college.edu', 'hostel', 'hostel123', 'Hostel Warden', { employeeId: 'HOSTEL001' });
    await seedUser('transport@college.edu', 'transport', 'transport123', 'Transport Manager', { employeeId: 'TRANS001' });
    await seedUser('hr@college.edu', 'hr', 'hr123', 'HR Department Staff', { employeeId: 'HR001' });
    await seedUser('admissions@college.edu', 'admission_office', 'admissions123', 'Admissions Office', { employeeId: 'ADM001' });

    // 5. Seed Student Record
    let record = await StudentRecord.findOne({ rollNumber: '21011A0401', collegeCode: 'ASCET001' });
    if (!record) {
      record = await StudentRecord.create({
        studentId: 'STUDENT001',
        rollNumber: '21011A0401',
        admissionNumber: 'ADM-2021-0401',
        fullName: 'Student ASCET',
        gender: 'Male',
        dob: new Date('2003-05-15'),
        department: 'ECE',
        branch: 'ECE',
        course: 'B.TECH',
        academicYear: '2021-2025',
        semester: 3,
        section: 'F',
        collegeCode: 'ASCET001',
        status: 'Active'
      });
      console.log('✅ [Seed Master Data] Seeded Student Record: 21011A0401');
    }

    // 6. Seed Student User Linked to Record
    let studentUser = await User.findOne({ email: 'student@college.edu' });
    if (!studentUser) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('student123', salt);
      studentUser = await User.create({
        fullName: 'Student ASCET',
        email: 'student@college.edu',
        password: hashedPassword,
        username: 'student_ascet',
        role: 'student',
        accountType: 'student',
        collegeCode: 'ASCET001',
        rollNumber: '21011A0401',
        studentId: 'STUDENT001',
        branch: 'ECE',
        year: 3,
        semester: 3,
        section: 'F',
        isCollegeConnected: true,
        isActive: true
      });
      record.linkedUserId = studentUser._id;
      await record.save();
    }

    // 7. Seed ECE Faculty Members
    await seedUser('mprasad@college.edu', 'faculty', 'faculty123', 'Mr. M. Prasad Rao', { employeeId: 'ECEFAC031', assignedDepartment: 'ECE' });
    await seedUser('gchenchu@college.edu', 'faculty', 'faculty123', 'Dr. G. Chenchu Krishnaiah', { employeeId: 'ECEFAC032', assignedDepartment: 'ECE' });
    await seedUser('psreelakshmi@college.edu', 'faculty', 'faculty123', 'Dr. P. Sreelakshmi', { employeeId: 'ECEFAC033', assignedDepartment: 'ECE' });
    await seedUser('nptel@college.edu', 'faculty', 'faculty123', 'NPTEL Faculty', { employeeId: 'ECEFAC034', assignedDepartment: 'ECE' });
    await seedUser('fme@college.edu', 'faculty', 'faculty123', 'FME Faculty', { employeeId: 'ECEFAC035', assignedDepartment: 'ECE' });

    // 8. Seed ECE Subjects referencing their matched Faculty
    const seedSubject = async (subjectCode, name, facultyEmail, semester, type) => {
      const collegeCode = 'ASCET001';
      const department = 'ECE';
      
      const exists = await Subject.findOne({ collegeCode, department, subjectCode: subjectCode.toUpperCase() });
      if (!exists) {
        let facultyId = null;
        if (facultyEmail) {
          const facUser = await User.findOne({ email: facultyEmail.toLowerCase() });
          if (facUser) facultyId = facUser._id;
        }
        
        await Subject.create({
          collegeCode,
          department,
          subjectCode: subjectCode.toUpperCase(),
          name,
          credits: 4,
          semester,
          type: type || 'Theory',
          faculty: facultyId
        });
        console.log(`✅ [Seed Master Data] Seeded Subject: ${subjectCode} - ${name}`);
      }
    };

    await seedSubject('23EC501', 'Analog & Digital IC Applications (ADIC)', 'mprasad@college.edu', 5, 'Theory');
    await seedSubject('23EC502', 'Digital Signal Processing', 'gchenchu@college.edu', 5, 'Theory');
    await seedSubject('23EC503', 'Microprocessors & Microcontrollers', 'psreelakshmi@college.edu', 5, 'Theory');
    await seedSubject('23EC504', 'Antennas & Wave Propagation', 'nptel@college.edu', 5, 'Theory');
    await seedSubject('23ESX02', 'Fluid Mechanics & E', 'fme@college.edu', 5, 'Theory');

  } catch (err) {
    console.error('❌ [Seed Master Data] Error seeding data:', err.message);
  }
};

module.exports = seedMasterData;
