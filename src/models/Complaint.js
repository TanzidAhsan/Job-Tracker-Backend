const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['provider', 'job', 'application', 'user'] },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    message: { type: String, required: true },
    status: { type: String, enum: ['open', 'in_review', 'resolved', 'rejected'], default: 'open' },
    adminResponse: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Complaint', complaintSchema);
