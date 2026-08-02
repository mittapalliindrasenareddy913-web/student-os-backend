const mongoose = require('mongoose');

const GroupCategorySchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    icon:        { type: String, default: '📚' },
    description: { type: String, default: '', trim: true },
    code:        { type: String, unique: true, required: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('GroupCategory', GroupCategorySchema);
