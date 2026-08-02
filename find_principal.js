const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const College = require('./models/College');

async function findPrincipal() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/studentos');
  console.log('--- Colleges in DB ---');
  const colleges = await College.find({});
  console.log(colleges.map(c => ({ code: c.collegeCode, name: c.name, status: c.status })));

  console.log('--- Principals / Staff in DB ---');
  const staff = await User.find({ role: { $in: ['principal', 'hod', 'faculty', 'super_admin', 'admin'] } });
  console.log(staff.map(s => ({ fullName: s.fullName, email: s.email, role: s.role, collegeCode: s.collegeCode, isActive: s.isActive })));
  
  process.exit(0);
}

findPrincipal().catch(err => {
  console.error(err);
  process.exit(1);
});
