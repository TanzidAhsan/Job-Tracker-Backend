const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    companyEmail: String,
    companyPhone: String,
    companyWebsite: String,
    industry: String,
    location: String,
    description: String,
    employeeCount: String,
    companyLogo: String,
    // Documents uploaded by provider for verification (PDFs)
    companyDocs: [
      {
        _id: false,
        filename: String,
        contentType: String,
        data: Buffer,
      },
    ],
    taxId: String,
    businessLicense: String,
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verificationNotes: String,
    rejectionReason: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Provider', providerSchema);
