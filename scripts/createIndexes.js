/**
 * Campus OS — Database Index Migration
 * Run once in production to ensure all performance-critical indexes exist.
 *
 * Usage:
 *   node scripts/createIndexes.js
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Force Google DNS for Atlas SRV lookups
const mongoose = require('mongoose');

async function createIndexes() {
  console.log('📦  Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('✅  Connected.\n');

  const indexes = [
    // Users
    { col: 'users', index: { email: 1 },                        opts: { unique: true, name: 'email_unique' } },
    { col: 'users', index: { collegeCode: 1, role: 1 },          opts: { name: 'college_role' } },
    { col: 'users', index: { rollNumber: 1, collegeCode: 1 },     opts: { sparse: true, name: 'roll_college' } },

    // Attendance
    { col: 'attendances', index: { studentId: 1, subject: 1, date: -1 }, opts: { name: 'student_subject_date' } },
    { col: 'attendances', index: { facultyId: 1, date: -1 },              opts: { name: 'faculty_date' } },
    { col: 'attendances', index: { collegeCode: 1, date: -1 },            opts: { name: 'college_date' } },

    // Audit logs
    { col: 'auditlogs', index: { collegeCode: 1, createdAt: -1 }, opts: { name: 'college_created' } },
    { col: 'auditlogs', index: { actorId: 1, createdAt: -1 },     opts: { name: 'actor_created' } },
    { col: 'auditlogs', index: { module: 1, action: 1 },          opts: { name: 'module_action' } },

    // Exam results
    { col: 'examresults', index: { studentId: 1, semester: 1, collegeCode: 1 }, opts: { name: 'student_sem_college' } },
    { col: 'examresults', index: { collegeCode: 1, status: 1 },                 opts: { name: 'college_status' } },

    // Exam marks
    { col: 'exammarks', index: { studentId: 1, collegeCode: 1, type: 1 }, opts: { name: 'student_college_type' } },

    // Hall tickets
    { col: 'halltickets', index: { collegeCode: 1, status: 1 }, opts: { name: 'college_status' } },
    { col: 'halltickets', index: { studentId: 1 },              opts: { name: 'student' } },

    // Notifications
    { col: 'notifications', index: { userId: 1, isRead: 1, createdAt: -1 }, opts: { name: 'user_read_created' } },

    // Community posts
    { col: 'posts', index: { collegeCode: 1, createdAt: -1 }, opts: { name: 'college_created' } },
    { col: 'posts', index: { authorId: 1, createdAt: -1 },     opts: { name: 'author_created' } },

    // Tasks
    { col: 'tasks', index: { userId: 1, dueDate: 1 }, opts: { name: 'user_due' } },

    // Timetables
    { col: 'timetables', index: { collegeCode: 1, department: 1, year: 1, section: 1 }, opts: { name: 'college_dept_year_section' } },

    // Faculty materials
    { col: 'materials', index: { collegeCode: 1, department: 1 }, opts: { name: 'college_dept' } },

    // Revaluation requests
    { col: 'revaluationrequests', index: { collegeCode: 1, status: 1 }, opts: { name: 'college_status' } },

    // College collection
    { col: 'colleges', index: { collegeCode: 1 }, opts: { unique: true, name: 'code_unique' } },
  ];

  let created = 0;
  let skipped = 0;

  for (const { col, index, opts } of indexes) {
    try {
      const collection = db.collection(col);
      const existingIndexes = await collection.indexes();
      const keyStr = JSON.stringify(index);
      const alreadyHasIndex = existingIndexes.some(idx => JSON.stringify(idx.key) === keyStr || idx.name === opts.name);
      if (alreadyHasIndex) {
        console.log(`  ⏭️  ${col}.${opts.name} — already exists`);
        skipped++;
      } else {
        await collection.createIndex(index, opts);
        console.log(`  ✅  ${col}.${opts.name} — created`);
        created++;
      }
    } catch (err) {
      console.error(`  ❌  ${col}.${opts.name} — ERROR: ${err.message}`);
    }
  }

  console.log(`\n📊  Done. Created: ${created}  Skipped: ${skipped}`);
  await mongoose.disconnect();
  process.exit(0);
}

createIndexes().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
