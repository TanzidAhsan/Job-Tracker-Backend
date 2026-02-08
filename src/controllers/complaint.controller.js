const Complaint = require('../models/Complaint');

// Create complaint
const createComplaint = async (req, res) => {
  try {
    const { targetType, targetId, message } = req.body;

    if (!message || !targetType) {
      return res.status(400).json({ message: 'Message and targetType required' });
    }

    const complaint = new Complaint({
      userId: req.user._id,
      targetType,
      targetId,
      message,
    });

    await complaint.save();

    res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user complaints
const getUserComplaints = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let filter = { userId: req.user._id };
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const complaints = await Complaint.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Complaint.countDocuments(filter);

    res.json({
      complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all complaints (admin)
const getAllComplaints = async (req, res) => {
  try {
    const { status, targetType, page = 1, limit = 10 } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (targetType) filter.targetType = targetType;

    const skip = (page - 1) * limit;

    const complaints = await Complaint.find(filter)
      .populate('userId')
      .populate('targetId')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Complaint.countDocuments(filter);

    res.json({
      complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Admin: Review complaint and respond
const reviewComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminResponse } = req.body;

    if (!['open', 'in_review', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      id,
      { status, adminResponse },
      { new: true }
    );

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    res.json({
      message: 'Complaint updated',
      complaint,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createComplaint,
  getUserComplaints,
  getAllComplaints,
  reviewComplaint,
};
