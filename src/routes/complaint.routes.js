const express = require('express');
const router = express.Router();
const {
  createComplaint,
  getUserComplaints,
  getAllComplaints,
  reviewComplaint,
} = require('../controllers/complaint.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth.middleware');

// Create complaint
router.post('/', authMiddleware, createComplaint);

// Get user's own complaints
router.get('/my-complaints', authMiddleware, getUserComplaints);

// Admin: Get all complaints
router.get('/admin/all', authMiddleware, roleMiddleware(['admin']), getAllComplaints);

// Admin: Review complaint
router.put('/admin/:id/review', authMiddleware, roleMiddleware(['admin']), reviewComplaint);

module.exports = router;
