const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const uri = process.env.MONGO_URI;
console.log('Connecting to:', uri);

mongoose.connect(uri).then(async () => {
  console.log('Connected successfully!');
  const users = await mongoose.connection.db.collection('users').find({role: 'hod'}).toArray();
  console.log('HOD Users:', users.map(u => ({ email: u.email, collegeCode: u.collegeCode, assignedDepartment: u.assignedDepartment })));
  
  const studentRecords = await mongoose.connection.db.collection('studentrecords').find({rollNumber: '25G2A04LA2'}).toArray();
  console.log('Student Records for 25G2A04LA2:', studentRecords.map(s => ({ rollNumber: s.rollNumber, collegeCode: s.collegeCode, linkedUserId: s.linkedUserId })));

  const collegeUser = await mongoose.connection.db.collection('users').find({username: '25g2a04la2'}).toArray();
  console.log('User Accounts for student:', collegeUser.map(u => ({ username: u.username, collegeCode: u.collegeCode, accountType: u.accountType })));

  process.exit(0);
}).catch(err => {
  console.error('Connection failed:', err);
  process.exit(1);
});
