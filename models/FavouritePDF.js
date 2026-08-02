const mongoose = require('mongoose');

const FavouritePDFSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true }
}, { timestamps: true });

FavouritePDFSchema.index({ user: 1, fileName: 1 }, { unique: true });

module.exports = mongoose.model('FavouritePDF', FavouritePDFSchema);
