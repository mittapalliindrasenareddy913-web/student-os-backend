require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Force Google DNS for Atlas SRV lookups
const mongoose = require('mongoose');
const College = require('../models/College');
const apColleges = require('../utils/apCollegesData');

const seedColleges = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in the environment.');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully.');

    let insertedCount = 0;
    let skippedCount = 0;

    for (const collegeData of apColleges) {
      const exists = await College.findOne({ collegeCode: collegeData.collegeCode.toUpperCase() });
      if (!exists) {
        await College.create(collegeData);
        console.log(`✅ Seeded: ${collegeData.name} (${collegeData.collegeCode})`);
        insertedCount++;
      } else {
        // Update attributes to match the seed file
        exists.name = collegeData.name;
        exists.address = collegeData.address;
        exists.university = collegeData.university;
        exists.state = collegeData.state;
        exists.district = collegeData.district;
        exists.aisheCode = collegeData.aisheCode;
        exists.collegeType = collegeData.collegeType;
        exists.naacGrade = collegeData.naacGrade;
        exists.verifiedBadge = collegeData.verifiedBadge;
        exists.status = collegeData.status;
        await exists.save();
        skippedCount++;
      }
    }

    console.log(`\n🎉 Seeding Completed!`);
    console.log(`Inserted: ${insertedCount}`);
    console.log(`Updated/Skipped: ${skippedCount}`);

  } catch (err) {
    console.error('❌ Error seeding colleges:', err.message);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
    process.exit(0);
  }
};

seedColleges();
