const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/student-os';

async function checkStudent() {
  try {
    console.log('Connecting to:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected!');

    // Define schemas inline to avoid dependencies issues
    const StudentRecordSchema = new mongoose.Schema({
      rollNumber: String,
      fullName: String,
      branch: String,
      section: String,
      semester: Number,
      linkedUserId: mongoose.Schema.Types.ObjectId,
      collegeCode: String
    }, { collection: 'studentrecords' });

    const StudentRecord = mongoose.model('StudentRecord', StudentRecordSchema);

    // Search for student
    const student = await StudentRecord.findOne({
      rollNumber: { $regex: new RegExp('^25g2a04la2$', 'i') }
    });

    if (student) {
      console.log('STUDENT FOUND:');
      console.log(JSON.stringify(student, null, 2));
    } else {
      console.log('Student 25g2a04la2 NOT found in StudentRecord. Let us list all student records:');
      const all = await StudentRecord.find().limit(10).lean();
      console.log(JSON.stringify(all, null, 2));
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

checkStudent();
