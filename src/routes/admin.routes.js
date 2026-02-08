const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  toggleUserStatus,
  getPlatformStats,
  getAllProviders,
  verifyProvider,
  getProviderById,
  downloadProviderDoc,
  getAllJobsAdmin,
  deactivateJob,
} = require('../controllers/admin.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth.middleware');

// Get all users
router.get('/users', authMiddleware, roleMiddleware(['admin']), getAllUsers);

// Toggle user status (deactivate/activate)
router.put(
  '/users/:userId/status',
  authMiddleware,
  roleMiddleware(['admin']),
  toggleUserStatus
);

// Get platform statistics
router.get('/stats', authMiddleware, roleMiddleware(['admin']), getPlatformStats);

// Get all providers
router.get(
  '/providers',
  authMiddleware,
  roleMiddleware(['admin']),
  getAllProviders
);

// Verify provider
router.put(
  '/providers/:providerId/verify',
  authMiddleware,
  roleMiddleware(['admin']),
  verifyProvider
);

// Get provider by id (metadata)
router.get(
  '/providers/:providerId',
  authMiddleware,
  roleMiddleware(['admin']),
  getProviderById
);

// Download a provider document by index
router.get(
  '/providers/:providerId/docs/:docId',
  authMiddleware,
  roleMiddleware(['admin']),
  downloadProviderDoc
);

// Get all jobs (for moderation)
router.get('/jobs', authMiddleware, roleMiddleware(['admin']), getAllJobsAdmin);

// Deactivate job
router.put(
  '/jobs/:jobId/deactivate',
  authMiddleware,
  roleMiddleware(['admin']),
  deactivateJob
);

module.exports = router;
