const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger for debugging file upload issues
app.use((req, res, next) => {
  try {
    const ct = req.headers['content-type'] || '';
    console.log('Incoming Request ->', req.method, req.originalUrl, 'Content-Type:', ct.substring(0,120), 'HasAuth:', !!req.headers.authorization);
  } catch (e) {}
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/applications', require('./routes/application.routes'));
app.use('/api/jobs', require('./routes/job.routes'));
app.use('/api/provider', require('./routes/provider.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/complaints', require('./routes/complaint.routes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

module.exports = app;
