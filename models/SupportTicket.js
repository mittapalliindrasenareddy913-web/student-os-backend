const mongoose = require('mongoose');

const SupportTicketSchema = new mongoose.Schema(
  {
    collegeCode: { type: String, required: true, uppercase: true },
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status:      { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open' },
    type:        { type: String, enum: ['ticket', 'feedback', 'bug', 'feature'], default: 'ticket' },
    response:    { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.models.SupportTicket || mongoose.model('SupportTicket', SupportTicketSchema);
