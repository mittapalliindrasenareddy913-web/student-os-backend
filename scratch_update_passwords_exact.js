require('dotenv').config({ path: 'c:/Users/mitta/OneDrive/my projects/STUDENT OS/backend/.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');

async function updateAll() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Atlas');

    const hashedPassword = await bcrypt.hash('ASCET001', 10);

    // Update ALL HOD accounts
    const hodResult = await User.updateMany(
      { role: 'hod' },
      { $set: { password: hashedPassword, status: 'ACTIVE', isActive: true, collegeCode: 'ASCET001' } }
    );
    console.log(`Updated ${hodResult.modifiedCount} HOD accounts to password: ASCET001`);

    // Update ALL Faculty accounts
    const facResult = await User.updateMany(
      { role: 'faculty' },
      { $set: { password: hashedPassword, status: 'ACTIVE', isActive: true, collegeCode: 'ASCET001' } }
    );
    console.log(`Updated ${facResult.modifiedCount} Faculty accounts to password: ASCET001`);

    // Verify HOD user
    const hodUser = await User.findOne({ role: 'hod' });
    if (hodUser) {
      const isHodMatch = await bcrypt.compare('ASCET001', hodUser.password);
      console.log(`VERIFICATION - HOD (${hodUser.email} / ${hodUser.employeeId}): password ASCET001 valid? -> ${isHodMatch}`);
    }

    // Verify Faculty user
    const facUser = await User.findOne({ role: 'faculty' });
    if (facUser) {
      const isFacMatch = await bcrypt.compare('ASCET001', facUser.password);
      console.log(`VERIFICATION - Faculty (${facUser.email} / ${facUser.employeeId}): password ASCET001 valid? -> ${isFacMatch}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

updateAll();
