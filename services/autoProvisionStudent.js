const User = require('../models/User');
const bcrypt = require('bcryptjs');

/**
 * Automatically provisions a User account for a given StudentRecord.
 * Default Credentials:
 * - Username: Roll Number (lowercase)
 * - Password: Roll Number (hashed using bcrypt)
 */
async function autoProvisionUserForStudent(record) {
  try {
    const rollClean = record.rollNumber.toUpperCase().trim();
    const rollLower = rollClean.toLowerCase();
    const collegeUpper = record.collegeCode.toUpperCase().trim();

    // Check if user already exists with this collegeCode and rollNumber / username
    let user = await User.findOne({
      collegeCode: collegeUpper,
      $or: [
        { username: rollLower },
        { rollNumber: rollClean }
      ]
    });

    if (!user) {
      // Check if temporary generated email is unique
      const tempEmail = `${rollLower}@${collegeUpper.toLowerCase()}.temp.studentos.com`;
      let emailUser = await User.findOne({ email: tempEmail });
      let finalEmail = tempEmail;
      
      // If by any chance it's taken, append a random string
      if (emailUser) {
        finalEmail = `${rollLower}_${Math.floor(1000 + Math.random() * 9000)}@${collegeUpper.toLowerCase()}.temp.studentos.com`;
      }

      // Hash the password using Roll Number
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(rollClean, salt);

      // Extract year from semester primarily, fallback to academicYear calculation
      let yearVal = 1;
      if (record.semester) {
        yearVal = Math.ceil(Number(record.semester) / 2) || 1;
      } else if (record.academicYear) {
        const parsedYear = parseInt(record.academicYear.split('-')[0], 10);
        if (!isNaN(parsedYear)) {
          const currentYear = new Date().getFullYear();
          const calculatedYear = currentYear - parsedYear + 1;
          yearVal = Math.min(Math.max(calculatedYear, 1), 5);
        }
      }

      user = await User.create({
        fullName: record.fullName,
        email: finalEmail,
        password: hashedPassword,
        username: rollLower,
        role: 'student',
        accountType: 'college',
        collegeLinked: true,
        isCollegeConnected: true,
        collegeCode: collegeUpper,
        rollNumber: rollClean,
        branch: record.branch || record.department || '',
        department: record.department || record.branch || '',
        year: record.year || yearVal,
        semester: record.semester || 1,
        section: record.section || 'A',
        firstLogin: true
      });

      console.log(`👤 [Auto-Provision] Created user for student ${rollClean} with temporary email: ${finalEmail}`);
    }

    // Link the StudentRecord to the User if not already linked
    if (!record.linkedUserId) {
      record.linkedUserId = user._id;
      await record.save();
    }
    
    return user;
  } catch (err) {
    console.error(`❌ [Auto-Provision] Failed to auto-provision user for StudentRecord:`, err);
    return null;
  }
}

module.exports = { autoProvisionUserForStudent };
