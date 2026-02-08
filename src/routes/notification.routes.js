const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} = require('../controllers/notification.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Get notifications
router.get('/', authMiddleware, getNotifications);

// Get unread count
router.get('/unread/count', authMiddleware, getUnreadCount);

// Mark as read
router.put('/:id/read', authMiddleware, markAsRead);

// Mark all as read
router.put('/read/all', authMiddleware, markAllAsRead);

// Delete notification
router.delete('/:id', authMiddleware, deleteNotification);

module.exports = router;
