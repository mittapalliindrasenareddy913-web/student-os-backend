const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = "mongodb+srv://studentosuser:StudentOS2026@cluster0.w5oetgr.mongodb.net/student-os?retryWrites=true&w=majority&appName=Cluster0&family=4";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");
  
  const users = await User.find({ role: { $ne: 'student' } }).select('email fullName username role collegeCode').limit(20);
  console.log("Non-student Users:");
  console.log(JSON.stringify(users, null, 2));
  
  await mongoose.disconnect();
}

run().catch(console.error);
