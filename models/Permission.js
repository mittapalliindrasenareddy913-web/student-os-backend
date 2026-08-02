const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, unique: true, lowercase: true, trim: true }, // e.g. 'publish_attendance'
    module: { type: String, required: true, lowercase: true, trim: true } // e.g. 'academics'
  },
  { timestamps: true }
);

module.exports = mongoose.models.Permission || mongoose.model('Permission', PermissionSchema);
