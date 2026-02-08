const express = require('express');
const router = express.Router();
const {
  createJob,
  getAllJobs,
  getProviderJobs,
  getJobById,
  updateJob,
  deleteJob,
} = require('../controllers/job.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth.middleware');

// Get all jobs (public)
router.get('/', getAllJobs);

// Get job by ID (public)
router.get('/:id', getJobById);

// Create job (Provider only)
router.post('/', authMiddleware, roleMiddleware(['provider']), createJob);

// Get provider's jobs
router.get(
  '/provider/jobs',
  authMiddleware,
  roleMiddleware(['provider']),
  getProviderJobs
);

// Update job (Provider only)
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['provider']),
  updateJob
);

// Delete job (Provider only)
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['provider']),
  deleteJob
);

module.exports = router;
