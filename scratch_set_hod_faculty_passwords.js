require('dotenv').config({ path: 'c:/Users/mitta/OneDrive/my projects/STUDENT OS/backend/.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/campus_os';

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

async function syncPasswords() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Atlas');

    const hashedPassword = await bcrypt.hash('ASCET001', 10);

    // 1. Update/set HOD accounts
    const hods = await User.find({ role: 'hod' });
    for (let hod of hods) {
      hod.password = hashedPassword;
      if (!hod.username) {
        hod.username = hod.employeeId ? hod.employeeId.toLowerCase() : 'hod';
      }
      hod.status = 'active';
      hod.collegeCode = 'ASCET001';
      await hod.save();
      console.log(`Updated HOD: email=${hod.email}, username=${hod.username}, empId=${hod.employeeId}`);
    }

    // 2. Create standard fallback HOD account if missing
    let defaultHod = await User.findOne({ collegeCode: 'ASCET001', role: 'hod', email: 'hod@college.edu' });
    if (!defaultHod) {
      defaultHod = new User({
        fullName: 'Head of Department (CSE/ECE)',
        email: 'hod@college.edu',
        username: 'hod',
        employeeId: 'ECEHOD001',
        password: hashedPassword,
        role: 'hod',
        department: 'CSE',
        collegeCode: 'ASCET001',
        status: 'active'
      });
      await defaultHod.save();
      console.log('Created default HOD account: hod@college.edu / hod / ECEHOD001');
    }

    // 3. Update/set Faculty accounts
    const facultyList = await User.find({ role: 'faculty' });
    for (let fac of facultyList) {
      fac.password = hashedPassword;
      if (!fac.username) {
        fac.username = fac.employeeId ? fac.employeeId.toLowerCase() : 'faculty';
      }
      fac.status = 'active';
      fac.collegeCode = 'ASCET001';
      await fac.save();
      console.log(`Updated Faculty: email=${fac.email}, username=${fac.username}, empId=${fac.employeeId}`);
    }

    // 4. Create standard fallback Faculty account if missing
    let defaultFaculty = await User.findOne({ collegeCode: 'ASCET001', role: 'faculty', email: 'faculty@college.edu' });
    if (!defaultFaculty) {
      defaultFaculty = new User({
        fullName: 'Faculty Member',
        email: 'faculty@college.edu',
        username: 'faculty',
        employeeId: 'ECEFAC023',
        password: hashedPassword,
        role: 'faculty',
        department: 'CSE',
        collegeCode: 'ASCET001',
        status: 'active'
      });
      await defaultFaculty.save();
      console.log('Created default Faculty account: faculty@college.edu / faculty / ECEFAC023');
    }

    console.log('✅ HOD and Faculty user passwords and usernames successfully updated to ASCET001!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

syncPasswords();
