const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['applicant', 'provider', 'admin'],
      default: 'applicant',
    },
    phone: String,
    profilePhoto: String,
    // Profile image stored as blob in DB
    profileImageFile: {
      data: Buffer,
      contentType: String,
      filename: String,
    },
    resume: String,
    // Resume stored as PDF in DB (optional)
    resumeFile: {
      data: Buffer,
      contentType: String,
      filename: String,
    },
    bio: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,
    // Applicant specific fields
    location: String,
    skills: [String],
    experience: Number, // years of experience
    // Provider specific fields
    companyName: String,
    companyType: String,
    companySize: String,
    website: String,
    taxId: String,
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (passwordToCheck) {
  return await bcrypt.compare(passwordToCheck, this.password);
};

// Remove password from response
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);
