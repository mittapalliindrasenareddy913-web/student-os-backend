const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Fix Atlas connection

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI;

async function resetHOD() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB!');

    const employeeId = 'ECEHOD001';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(employeeId, salt); // Password will be 'ECEHOD001'

    const result = await mongoose.connection.db.collection('users').updateOne(
      { employeeId: employeeId },
      {
        $set: {
          password: hashedPassword,
          department: 'ECE',
          role: 'hod',
          status: 'ACTIVE',
          isActive: true
        }
      }
    );

    if (result.matchedCount > 0) {
      console.log(`\n==================================================`);
      console.log(`SUCCESS: HOD user ${employeeId} reset!`);
      console.log(`==================================================`);
      console.log(`College Code:  ASCET001`);
      console.log(`Employee ID:   ECEHOD001`);
      console.log(`Password:      ECEHOD001`);
      console.log(`Department:    ECE`);
      console.log(`==================================================\n`);
    } else {
      console.log('HOD user not found.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

resetHOD();
