const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({
  senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderName: { type: String, required: true },
  senderRole: { type: String, required: true },
  message:    { type: String, required: true },
  createdAt:  { type: Date, default: Date.now }
});

const SupportTicketSchema = new mongoose.Schema(
  {
    ticketId:    { type: String, required: true, unique: true },
    collegeCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category:    { type: String, enum: ['Technical', 'Billing', 'Feature Request', 'Access Issue', 'General'], default: 'Technical' },
    priority:    { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
    status:      { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    creatorName: { type: String, default: 'Admin User' },
    assignedTo:  { type: String, default: 'Super Admin Desk' },
    replies:     [ReplySchema]
  },
  { timestamps: true }
);

module.exports = mongoose.models.SupportTicket || mongoose.model('SupportTicket', SupportTicketSchema);
