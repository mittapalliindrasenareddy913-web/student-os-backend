const dns = require('dns');
dns.setServers(['8.8.8.8']);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const uri = process.env.MONGO_URI;

mongoose.connect(uri).then(async () => {
  console.log('Connected to database.');
  const users = await mongoose.connection.db.collection('users').find({ role: 'student', semester: { $exists: true } }).toArray();
  console.log(`Found ${users.length} student users.`);
  
  for (const u of users) {
    const correctYear = Math.ceil(Number(u.semester) / 2) || 1;
    if (u.year !== correctYear) {
      await mongoose.connection.db.collection('users').updateOne({ _id: u._id }, { $set: { year: correctYear } });
      console.log(`Corrected year for user: ${u.username} (Sem: ${u.semester}) from ${u.year} to ${correctYear}`);
    }
  }
  
  console.log('All student years synced successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Failed to sync student years:', err);
  process.exit(1);
});
