require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const backupDirectory = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDirectory)) {
  fs.mkdirSync(backupDirectory, { recursive: true });
}

const performBackup = async () => {
  try {
    console.log('🚀 [Backup Service] Starting database dump...');
    await mongoose.connect(process.env.MONGO_URI);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFolder = path.join(backupDirectory, `backup-${timestamp}`);
    fs.mkdirSync(backupFolder);

    for (const coll of collections) {
      const name = coll.name;
      const data = await db.collection(name).find({}).toArray();
      fs.writeFileSync(
        path.join(backupFolder, `${name}.json`),
        JSON.stringify(data, null, 2)
      );
      console.log(`- Dumped collection "${name}" (${data.length} records)`);
    }

    console.log(`✅ [Backup Service] Database dump completed! Location: ${backupFolder}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ [Backup Service] Backup failed:', err.message);
    process.exit(1);
  }
};

performBackup();
