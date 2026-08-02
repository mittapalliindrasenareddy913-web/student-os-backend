require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/campus_os';

async function resetDbAndSuperAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    const db = mongoose.connection.db;

    // Get list of all collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections in database.`);

    // Wipe all collections except preserve system indexes
    for (const col of collections) {
      if (col.name !== 'system.indexes') {
        await db.collection(col.name).deleteMany({});
        console.log(`Cleared collection: ${col.name}`);
      }
    }

    // Create fresh Super Admin
    const hashedPassword = await bcrypt.hash('ISR@MB@d', 10);
    const User = db.collection('users');

    const superAdminDoc = {
      fullName: 'Indrasena Reddy',
      email: 'indra0408@campusos.in',
      username: 'indra0408',
      password: hashedPassword,
      role: 'super_admin',
      collegeCode: 'GLOBAL',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await User.insertOne(superAdminDoc);
    console.log('----------------------------------------------------');
    console.log('✅ SUCCESS: Database cleaned completely!');
    console.log('✅ Super Admin Account Set Up:');
    console.log('   Username: indra0408');
    console.log('   Password: ISR@MB@d');
    console.log('   Email:    indra0408@campusos.in');
    console.log('   Role:     super_admin');
    console.log('----------------------------------------------------');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting database:', err);
    process.exit(1);
  }
}

resetDbAndSuperAdmin();
