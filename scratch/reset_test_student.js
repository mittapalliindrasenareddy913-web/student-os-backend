const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Fix Atlas connection

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI;

async function resetStudent() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB!');

    const rollNo = '25G2A04LA2';
    
    // Find student user record in users collection
    const user = await mongoose.connection.db.collection('users').findOne({ rollNumber: rollNo });
    
    if (!user) {
      console.log(`Student ${rollNo} not found in users collection.`);
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rollNo, salt); // Password will be '25G2A04LA2'

    const result = await mongoose.connection.db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          collegeCode: 'ASCET001', // Set the correct college code
          status: 'ACTIVE',
          isActive: true
        }
      }
    );

    if (result.matchedCount > 0) {
      console.log(`\n==================================================`);
      console.log(`SUCCESS: Student ${rollNo} updated in database!`);
      console.log(`==================================================`);
      console.log(`College Code:  ASCET001 (Updated!)`);
      console.log(`Roll Number:   25G2A04LA2`);
      console.log(`Password:      25G2A04LA2 (Reset to roll number!)`);
      console.log(`==================================================\n`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

resetStudent();
