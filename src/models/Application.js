const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    status: {
      type: String,
      enum: ['Applied', 'Interview', 'Offer', 'Rejected', 'Withdrawn'],
      default: 'Applied',
    },
    appliedDate: {
      type: Date,
      default: Date.now,
    },
    interviewDate: Date,
    interviewNotes: String,
    offerDetails: String,
    coverLetter: String,
    resumeUsed: String,
    // Store resume PDF snapshot for this application in DB
    resume: {
      data: Buffer,
      contentType: String,
      filename: String,
    },
    rating: Number,
    feedback: String,
  },
  { timestamps: true }
);

// Ensure one application per user per job
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
