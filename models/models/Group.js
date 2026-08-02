const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    semester:    { type: Number, min: 1, max: 10, default: null },
    type:        { type: String, enum: ['public', 'private'], default: 'public' },
    avatar:      { type: String, default: '' },
    
    admin:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    inviteCode:  { type: String, unique: true, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Group', GroupSchema);
