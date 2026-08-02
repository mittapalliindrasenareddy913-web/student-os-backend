require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const College = require('../models/College');

const verify = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const count = await College.countDocuments({ state: 'Andhra Pradesh' });
    console.log(`\n🔍 Verified AP Colleges Count in Database: ${count}\n`);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

verify();
