const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
require('dotenv').config({ path: 'e:/indra projects/STUDENT OS/student-os-backend-main/.env' });
const User = require('../models/User');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const facultyList = await User.find({ role: 'faculty' }).limit(3);
    console.log('Faculty in DB:');
    facultyList.forEach(f => {
      console.log(JSON.stringify(f, null, 2));
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

run();
