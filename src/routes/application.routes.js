const express = require('express');
const router = express.Router();
const {
  createApplication,
  getUserApplications,
  getApplicationById,
  downloadApplicationResume,
  updateApplicationStatus,
  deleteApplication,
  getUserStats,
} = require('../controllers/application.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// Create application (Applicant only) - accepts resume PDF upload
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['applicant']),
  upload.memory.single('resume'),
  createApplication
);

// Get user applications (Applicant only)
router.get('/', authMiddleware, roleMiddleware(['applicant']), getUserApplications);

// Get application resume PDF (must come before /:id route)
router.get('/:id/resume', authMiddleware, downloadApplicationResume);

// Get application by ID
router.get('/:id', authMiddleware, getApplicationById);

// Update application status (Provider only)
router.put(
  '/:id/status',
  authMiddleware,
  roleMiddleware(['provider']),
  updateApplicationStatus
);

// Delete application
router.delete('/:id', authMiddleware, deleteApplication);

// Get user statistics
router.get('/stats/user', authMiddleware, roleMiddleware(['applicant']), getUserStats);

module.exports = router;
