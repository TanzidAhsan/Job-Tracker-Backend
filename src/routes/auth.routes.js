const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  register,
  login,
  getCurrentUser,
  updateProfile,
} = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// Register
router.post(
  '/register',
  // accept applicant resume + optional provider docs
  upload.memory.fields([{ name: 'resume', maxCount: 1 }, { name: 'companyDocs', maxCount: 5 }]),
  [
    body('name', 'Name is required').not().isEmpty(),
    body('email', 'Valid email is required').isEmail(),
    body('password', 'Password must be at least 6 characters').isLength({
      min: 6,
    }),
    body('phone', 'Phone number is required').not().isEmpty(),
    body('role', 'Role must be applicant or provider').isIn(['applicant', 'provider']),
  ],
  register
);

// Login
router.post(
  '/login',
  [
    body('email', 'Valid email is required').isEmail(),
    body('password', 'Password is required').not().isEmpty(),
  ],
  login
);

// Get current user
router.get('/me', authMiddleware, getCurrentUser);

// Get current user's resume PDF
router.get('/me/resume', authMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    if (!user || !user.resumeFile || !user.resumeFile.data) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    res.contentType(user.resumeFile.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${user.resumeFile.filename}"`);
    res.send(user.resumeFile.data);
  } catch (error) {
    res.status(500).json({ message: 'Error downloading resume', error: error.message });
  }
});

// Get profile image blob
router.get('/me/profile-image', authMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    if (!user || !user.profileImageFile || !user.profileImageFile.data) {
      return res.status(404).json({ message: 'Profile image not found' });
    }
    res.contentType(user.profileImageFile.contentType);
    res.send(user.profileImageFile.data);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving profile image', error: error.message });
  }
});

// Update profile (accept resume PDF upload and profile image in one request)
router.put(
  '/profile',
  authMiddleware,
  // use mixed memory uploader so both image and pdf are accepted in same request
  upload.mixed.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'profileImage', maxCount: 1 },
  ]),
  updateProfile
);

// Upload profile image
router.post('/me/profile-image', authMiddleware, upload.imageMemory.single('profileImage'), async (req, res) => {
  try {
    const User = require('../models/User');
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const user = await User.findById(req.user._id);
    user.profileImageFile = {
      data: req.file.buffer,
      contentType: req.file.mimetype,
      filename: req.file.originalname,
    };
    await user.save();

    res.json({
      message: 'Profile image uploaded successfully',
      user: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading profile image', error: error.message });
  }
});

module.exports = router;
