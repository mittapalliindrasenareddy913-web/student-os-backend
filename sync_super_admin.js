require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/campus_os';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'student' },
  collegeCode: { type: String, default: 'GLOBAL' },
  status: { type: String, default: 'active' }
}, { strict: false });

const User = mongoose.model('User', userSchema);

async function main() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const hashedPassword = await bcrypt.hash('ISR@MB@d', 10);

    let user = await User.findOne({ username: 'indra0408' });
    if (!user) {
      user = await User.findOne({ role: 'super_admin' });
    }

    if (user) {
      console.log(`Updating existing Super Admin user: ${user.email} (${user.username})`);
      user.username = 'indra0408';
      user.password = hashedPassword;
      user.role = 'super_admin';
      user.status = 'active';
      await user.save();
      console.log('SUCCESS: Super Admin user updated to username: indra0408, password: ISR@MB@d');
    } else {
      console.log('Creating new Super Admin user...');
      user = new User({
        fullName: 'Super Admin',
        email: 'indra0408@campusos.in',
        username: 'indra0408',
        password: hashedPassword,
        role: 'super_admin',
        collegeCode: 'GLOBAL',
        status: 'active'
      });
      await user.save();
      console.log('SUCCESS: Super Admin user created with username: indra0408, password: ISR@MB@d');
    }

    await User.updateMany(
      { role: 'super_admin' },
      { $set: { password: hashedPassword, username: 'indra0408' } }
    );

    console.log('All Super Admin accounts synchronized.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
