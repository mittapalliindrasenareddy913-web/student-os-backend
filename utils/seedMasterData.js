const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seedMasterData = async () => {
  try {
    // Seed/Update Super Admin credentials
    const superAdminUsername = 'indra0408';
    const superAdminEmail = 'indra0408@campusos.in';

    let superAdmin = await User.findOne({
      $or: [
        { username: superAdminUsername },
        { email: superAdminEmail },
        { role: 'super_admin' }
      ]
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('ISR@MB@d', salt);

    if (!superAdmin) {
      await User.create({
        fullName: 'Indrasena Reddy',
        email: superAdminEmail,
        username: superAdminUsername,
        password: hashedPassword,
        role: 'super_admin',
        collegeCode: 'GLOBAL',
        status: 'active',
        isActive: true
      });
      console.log(`✅ [Seed Master Data] Super Admin created with username: ${superAdminUsername}`);
    } else {
      superAdmin.username = superAdminUsername;
      superAdmin.email = superAdminEmail;
      superAdmin.password = hashedPassword;
      superAdmin.role = 'super_admin';
      superAdmin.status = 'active';
      superAdmin.isActive = true;
      await superAdmin.save();
      console.log(`✅ [Seed Master Data] Super Admin verified & updated: ${superAdminUsername}`);
    }
  } catch (err) {
    console.error('❌ [Seed Master Data] Error:', err.message);
  }
};

module.exports = seedMasterData;
