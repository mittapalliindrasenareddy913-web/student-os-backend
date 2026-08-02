const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema(
  {
    isbn:        { type: String, required: true, unique: true, uppercase: true, trim: true },
    title:       { type: String, required: true, trim: true },
    author:      { type: String, required: true, trim: true },
    quantity:    { type: Number, default: 1 },
    available:   { type: Number, default: 1 },
    rentals: [
      {
        studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        issuedDate:   { type: Date, default: Date.now },
        dueDate:      { type: Date, required: true },
        returnedDate: { type: Date, default: null },
        fine:         { type: Number, default: 0 }
      }
    ],
    collegeCode: { type: String, required: true, uppercase: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Book || mongoose.model('Book', BookSchema);
