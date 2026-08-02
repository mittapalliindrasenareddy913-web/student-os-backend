const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Force Google DNS for Atlas SRV lookups

require('dotenv').config({ path: 'e:\\indra projects\\STUDENT OS\\backend\\.env' });
const mongoose = require('mongoose');

async function checkImports() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  
  const ErpImport = require('../models/ErpImport');
  
  console.log('Fetching last 5 ERP imports...');
  const logs = await ErpImport.find({}).sort({ createdAt: -1 }).limit(5).lean();
  console.log(JSON.stringify(logs, null, 2));
  
  await mongoose.disconnect();
}

checkImports();
