const User = require('../models/User');
const Provider = require('../models/Provider');
const { generateToken } = require('../utils/generateToken');
const { validationResult } = require('express-validator');

// Register
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array().map(e => e.msg).join(', '),
        errors: errors.array() 
      });
    }

    const { 
      name, email, password, role, phone, location, skills, experience, 
      companyName, companyEmail, companyPhone, companyType, companySize, companyWebsite, companyLocation, companyDescription, taxId, businessLicense 
    } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user with additional fields based on role
    const userData = {
      name,
      email,
      password,
      role: role || 'applicant',
      phone,
    };

    // Add role-specific fields
    if (role === 'applicant') {
      userData.location = location;
      userData.skills = skills ? (typeof skills === 'string' ? skills.split(',').map(s => s.trim()) : skills) : [];
      userData.experience = experience ? parseInt(experience) : 0;
      // Handle resume upload for applicants (store in DB as buffer)
      if (req.file && req.file.buffer) {
        userData.resumeFile = {
          data: req.file.buffer,
          contentType: req.file.mimetype,
          filename: req.file.originalname,
        };
      }
    } else if (role === 'provider') {
      userData.companyName = companyName;
      userData.companyType = companyType;
      userData.companySize = companySize;
      userData.website = companyWebsite;
      userData.taxId = taxId;
    }

    user = new User(userData);
    await user.save();

    // Create provider profile if registering as provider
    if (role === 'provider') {
      try {
        console.log('Creating provider profile...', { 
          userId: user._id,
          companyName, 
          hasCompanyDocs: !!(req.files?.companyDocs), 
          docCount: req.files?.companyDocs?.length || 0 
        });
        
        const provider = new Provider({
          userId: user._id,
          companyName: companyName || name,
          companyEmail: companyEmail,
          companyPhone: companyPhone,
          companyWebsite: companyWebsite,
          industry: companyType,
          location: companyLocation,
          description: companyDescription,
          employeeCount: companySize,
          verificationStatus: 'pending',
          businessLicense: businessLicense,
          taxId: taxId,
        });

        // Attach uploaded company docs (if any)
        if (req.files && req.files.companyDocs && Array.isArray(req.files.companyDocs)) {
          console.log('Attaching company docs:', req.files.companyDocs.length);
          provider.companyDocs = req.files.companyDocs.map((f) => ({
            filename: f.originalname,
            contentType: f.mimetype,
            data: f.buffer,
          }));
        } else {
          console.log('No company docs provided', { 
            hasReqFiles: !!req.files, 
            hasCompanyDocs: !!req.files?.companyDocs,
            isArray: Array.isArray(req.files?.companyDocs)
          });
        }
        
        await provider.save();
        console.log('Provider created successfully:', { 
          providerId: provider._id, 
          docsCount: provider.companyDocs?.length || 0,
          verificationStatus: provider.verificationStatus 
        });
      } catch (providerError) {
        console.error('Error creating provider profile:', providerError);
        throw providerError;
      }
    }

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    // Clean up uploaded file if there's an error
    if (req.file) {
      const fs = require('fs');
      const filePath = req.file.path;
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id, user.role);

    res.json({
      message: 'Login successful',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update profile
const updateProfile = async (req, res) => {
  try {
    console.log('UpdateProfile called. body keys:', Object.keys(req.body || {}));
    console.log('Files present:', Object.keys(req.files || {}));
    if (req.files) {
      Object.entries(req.files).forEach(([k, v]) => {
        console.log(` - file field ${k}: count=${Array.isArray(v)?v.length:0}`);
      });
    }
    const { name, phone, bio, profilePhoto, location, skills, experience } = req.body;

    const updateData = {
      name,
      phone,
      bio,
      profilePhoto,
    };

    // Add applicant-specific fields if provided
    if (location) updateData.location = location;
    if (skills) updateData.skills = typeof skills === 'string' ? skills.split(',').map(s => s.trim()) : skills;
    if (experience) updateData.experience = parseInt(experience);

    // If resume file uploaded (from multer fields), store in DB
    if (req.files && req.files.resume && req.files.resume[0] && req.files.resume[0].buffer) {
      const f = req.files.resume[0];
      updateData.resumeFile = {
        data: f.buffer,
        contentType: f.mimetype,
        filename: f.originalname,
      };
    }

    // If profile image uploaded (from multer fields), store in DB
    if (req.files && req.files.profileImage && req.files.profileImage[0] && req.files.profileImage[0].buffer) {
      const img = req.files.profileImage[0];
      updateData.profileImageFile = {
        data: img.buffer,
        contentType: img.mimetype,
        filename: img.originalname,
      };
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    );

    res.json({ message: 'Profile updated successfully', user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  updateProfile,
};
