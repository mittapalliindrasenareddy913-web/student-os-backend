const mongoose = require('mongoose');

const mongoUri = "mongodb+srv://studentosuser:StudentOS2026@cluster0.w5oetgr.mongodb.net/student-os?retryWrites=true&w=majority&appName=Cluster0&family=4";

async function run() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB!");

    const User = mongoose.connection.db.collection('users');
    const studentRecords = mongoose.connection.db.collection('studentrecords');

    const rollNumber = "24G2A04L65";

    const user = await User.findOne({ 
      $or: [
        { rollNumber: rollNumber },
        { rollNumber: rollNumber.toLowerCase() },
        { username: rollNumber.toLowerCase() }
      ]
    });
    console.log("User in DB:", JSON.stringify(user, null, 2));

    const record = await studentRecords.findOne({
      $or: [
        { rollNumber: rollNumber },
        { rollNumber: rollNumber.toLowerCase() }
      ]
    });
    console.log("StudentRecord in DB:", JSON.stringify(record, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
