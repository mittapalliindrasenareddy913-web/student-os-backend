const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Fix Atlas connection

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI;

async function listFaculties() {
  try {
    await mongoose.connect(mongoUri);
    const users = await mongoose.connection.db.collection('users').find({ role: 'faculty' }).toArray();
    
    console.log('\n========================================');
    console.log('         FACULTY USER ACCOUNTS          ');
    console.log('========================================');
    users.forEach((u, i) => {
      console.log(`${i+1}. Name:         ${u.fullName}`);
      console.log(`   Email:        ${u.email}`);
      console.log(`   Employee ID:  ${u.employeeId || 'None'}`);
      console.log(`   College Code: ${u.collegeCode || 'None'}`);
      console.log(`   First Login:  ${u.firstLogin}`);
      console.log('----------------------------------------');
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

listFaculties();
