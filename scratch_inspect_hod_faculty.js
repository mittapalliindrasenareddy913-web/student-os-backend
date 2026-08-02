require('dotenv').config({ path: 'c:/Users/mitta/OneDrive/my projects/STUDENT OS/backend/.env' });
const mongoose = require('mongoose');

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/campus_os';

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

async function inspect() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const hods = await User.find({ role: 'hod' }).lean();
    const faculty = await User.find({ role: 'faculty' }).lean();

    console.log('=== HOD USERS ===');
    hods.forEach(h => {
      console.log(`ID: ${h._id} | Code: ${h.collegeCode} | User: ${h.username} | Email: ${h.email} | EmpID: ${h.employeeId} | Name: ${h.fullName}`);
    });

    console.log('=== FACULTY USERS ===');
    faculty.forEach(f => {
      console.log(`ID: ${f._id} | Code: ${f.collegeCode} | User: ${f.username} | Email: ${f.email} | EmpID: ${f.employeeId} | Name: ${f.fullName}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

inspect();
