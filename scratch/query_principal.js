const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Force Google DNS for Atlas SRV lookups

require('dotenv').config({ path: 'e:\\indra projects\\STUDENT OS\\backend\\.env' });
const mongoose = require('mongoose');

async function checkPrincipal() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  
  const User = require('../models/User');
  
  console.log('Fetching Principal user...');
  const principal = await User.findOne({ role: 'principal' }).lean();
  console.log('Principal Document:', principal);
  
  await mongoose.disconnect();
}

checkPrincipal();
