const express = require('express');
const router = express.Router();
const {
  createProviderProfile,
  getProviderProfile,
  updateProviderProfile,
  resubmitProviderProfile,
  getProviderApplicants,
  getProviderStats,
} = require('../controllers/provider.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// Create provider profile (Provider only)
router.post(
  '/profile',
  authMiddleware,
  roleMiddleware(['provider']),
  createProviderProfile
);

// Get provider profile
router.get(
  '/profile',
  authMiddleware,
  roleMiddleware(['provider']),
  getProviderProfile
);

// Update provider profile (Provider only)
router.put(
  '/profile',
  authMiddleware,
  roleMiddleware(['provider']),
  // accept companyDocs (pdf) and companyLogo (image) via memory upload
  upload.mixed.fields([{ name: 'companyDocs', maxCount: 5 }, { name: 'companyLogo', maxCount: 1 }]),
  updateProviderProfile
);

// Resubmit provider profile for verification
router.post(
  '/profile/resubmit',
  authMiddleware,
  roleMiddleware(['provider']),
  resubmitProviderProfile
);

// Delete a provider document (by index)
router.delete(
  '/profile/docs/:docId',
  authMiddleware,
  roleMiddleware(['provider']),
  async (req, res, next) => {
    // Delegate to controller
    const { deleteProviderDoc } = require('../controllers/provider.controller');
    return deleteProviderDoc(req, res, next);
  }
);

// Get provider applicants
router.get(
  '/applicants',
  authMiddleware,
  roleMiddleware(['provider']),
  getProviderApplicants
);

// Get provider statistics
router.get(
  '/stats',
  authMiddleware,
  roleMiddleware(['provider']),
  getProviderStats
);

module.exports = router;
