require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find ALL super admins and remove old ones
    const allSuperAdmins = await User.find({ role: 'super_admin' });
    console.log(`Found ${allSuperAdmins.length} super admin(s):`, allSuperAdmins.map(u => u.email));

    // Delete all existing super admins
    await User.deleteMany({ role: 'super_admin' });
    console.log('🗑️  Removed all old super admin accounts');

    // Also remove any existing user with the target email (to avoid duplicate)
    await User.deleteMany({ email: 'mittapalliindrasenareddy913@gmail.com' });

    // Create fresh Super Admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('ISR@MB@d', salt);
    
    const superAdmin = await User.create({
      fullName: 'Indrasena Reddy',
      email: 'mittapalliindrasenareddy913@gmail.com',
      password: hashedPassword,
      role: 'super_admin',
      collegeCode: '473383',
      employeeId: 'SUPERADMIN001',
      isActive: true
    });

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║     ✅ SUPER ADMIN CREATED SUCCESSFULLY!             ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║  Name:     Indrasena Reddy                          ║');
    console.log('║  Email:    mittapalliindrasenareddy913@gmail.com     ║');
    console.log('║  Password: ISR@MB@d                                 ║');
    console.log('║  Code:     473383                                   ║');
    console.log('║  Role:     super_admin                              ║');
    console.log('╚══════════════════════════════════════════════════════╝');

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await mongoose.disconnect();
  }
};

run();
