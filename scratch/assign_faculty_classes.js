const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Force Google DNS for Atlas SRV lookups

require('dotenv').config({ path: 'e:\\indra projects\\STUDENT OS\\backend\\.env' });
const mongoose = require('mongoose');

async function assignClasses() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  
  const User = require('../models/User');
  
  console.log('Updating Faculty ECEFAC023 assignedClasses...');
  const result = await User.updateOne(
    { employeeId: 'ECEFAC023' },
    { 
      $set: { 
        assignedClasses: [
          { subject: 'Digital Signal Processing', year: 2, section: 'A' },
          { subject: 'Digital Signal Processing', year: 3, section: 'F' }
        ] 
      } 
    }
  );
  
  console.log('Update result:', result);
  
  const updatedUser = await User.findOne({ employeeId: 'ECEFAC023' }).select('assignedClasses').lean();
  console.log('Updated assignedClasses:', updatedUser.assignedClasses);
  
  await mongoose.disconnect();
}

assignClasses();
