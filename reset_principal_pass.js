const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('./models/User');

async function resetPass() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/studentos');
  
  const hashedPassword = await bcrypt.hash('ASCET001', 10);
  
  const res1 = await User.updateMany(
    { email: { $in: ['principal@campus.com', 'principal@college.edu'] } },
    { $set: { password: hashedPassword, isActive: true, status: 'ACTIVE' } }
  );

  console.log('Principal password reset result:', res1);
  process.exit(0);
}

resetPass().catch(err => {
  console.error(err);
  process.exit(1);
});
