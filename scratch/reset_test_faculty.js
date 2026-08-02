const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Fix Atlas connection

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI;

async function resetFaculty() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB!');

    const employeeId = 'ECEFAC031';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(employeeId, salt); // Password will be 'ECEFAC031'

    const result = await mongoose.connection.db.collection('users').updateOne(
      { employeeId: employeeId },
      {
        $set: {
          password: hashedPassword,
          firstLogin: true,
          faceVerificationData: null,
          status: 'ACTIVE',
          isActive: true
        }
      }
    );

    if (result.matchedCount > 0) {
      console.log(`\n==================================================`);
      console.log(`SUCCESS: Faculty user ${employeeId} reset!`);
      console.log(`==================================================`);
      console.log(`College Code:  ASCET001`);
      console.log(`Employee ID:   ECEFAC031`);
      console.log(`Password:      ECEFAC031`);
      console.log(`First Login:   true (Will open Profile Setup screen)`);
      console.log(`==================================================\n`);
    } else {
      console.log('Faculty user not found.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

resetFaculty();
