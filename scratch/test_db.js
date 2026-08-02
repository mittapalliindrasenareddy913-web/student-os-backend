require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Force Google DNS for Atlas SRV lookups
const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log("Connecting to:", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connection successful!");
    
    // Check schemas or test query
    const User = require('../models/User');
    const ErpImport = require('../models/ErpImport');
    
    const count = await User.countDocuments();
    console.log("User count in DB:", count);
    
    const importCount = await ErpImport.countDocuments();
    console.log("ErpImport count in DB:", importCount);
    
    await mongoose.disconnect();
    console.log("Disconnected successfully");
  } catch (error) {
    console.error("Connection failed:", error);
  }
}

testConnection();
