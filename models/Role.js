const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }]
  },
  { timestamps: true }
);

module.exports = mongoose.models.Role || mongoose.model('Role', RoleSchema);
