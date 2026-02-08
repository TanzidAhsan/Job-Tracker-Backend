const User = require('../models/User');
const Provider = require('../models/Provider');
const Job = require('../models/Job');
const Application = require('../models/Application');

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 10 } = req.query;

    let filter = {};
    if (role) filter.role = role;

    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort('-createdAt')
      .select('-password');

    const total = await User.countDocuments(filter);

    res.json({
      users,
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

// Block/Deactivate user
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get platform statistics
const getPlatformStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalApplicants = await User.countDocuments({ role: 'applicant' });
    const totalProviders = await User.countDocuments({ role: 'provider' });
    const totalJobs = await Job.countDocuments({ isActive: true });
    const totalApplications = await Application.countDocuments();
    const totalOffers = await Application.countDocuments({ status: 'Offer' });

    res.json({
      totalUsers,
      totalApplicants,
      totalProviders,
      totalJobs,
      totalApplications,
      totalOffers,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all providers (for verification)
const getAllProviders = async (req, res) => {
  try {
    const { verificationStatus, page = 1, limit = 10 } = req.query;

    let filter = {};
    if (verificationStatus) filter.verificationStatus = verificationStatus;

    const skip = (page - 1) * limit;

    const providers = await Provider.find(filter)
      .populate('userId')
      .skip(skip)
      .limit(parseInt(limit))
      .sort('-createdAt');

    const total = await Provider.countDocuments(filter);

    res.json({
      providers,
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

  // Get single provider (no heavy binary data) for admin view
  const getProviderById = async (req, res) => {
    try {
      const provider = await Provider.findById(req.params.providerId).populate('userId');
      if (!provider) return res.status(404).json({ message: 'Provider not found' });

      // Do not send binary blobs in list view; only send metadata for docs
      const docsMeta = (provider.companyDocs || []).map((d, idx) => ({
        _id: idx,
        filename: d.filename,
        contentType: d.contentType,
      }));

      res.json({ provider: { ...provider.toObject(), companyDocs: docsMeta } });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };

  // Admin: download a provider's document by index
  const downloadProviderDoc = async (req, res) => {
    try {
      console.log('Download doc request:', { providerId: req.params.providerId, docId: req.params.docId });
      
      const provider = await Provider.findById(req.params.providerId);
      if (!provider) {
        return res.status(404).json({ message: 'Provider not found' });
      }
      
      const idx = parseInt(req.params.docId, 10);
      if (Number.isNaN(idx) || idx < 0 || idx >= (provider.companyDocs || []).length) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      const doc = provider.companyDocs[idx];
      if (!doc || !doc.data) {
        return res.status(404).json({ message: 'Document data not found' });
      }
      
      res.contentType(doc.contentType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.filename || 'document.pdf'}"`);
      return res.send(doc.data);
    } catch (error) {
      console.error('Download doc error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };

// Verify provider (accepts or rejects)
const verifyProvider = async (req, res) => {
  try {
    const { status, reason } = req.body; // status: 'verified', 'rejected', 'pending'

    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const provider = await Provider.findByIdAndUpdate(
      req.params.providerId,
      // update verification status and store notes/reason appropriately
      {
        verificationStatus: status,
        ...(status === 'rejected' && reason ? { rejectionReason: reason } : {}),
        ...(status === 'pending' && reason ? { verificationNotes: reason } : {}),
        ...(status === 'verified' ? { rejectionReason: null, verificationNotes: null } : {}),
      },
      { new: true }
    );

    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    // Create notification for provider
    const Notification = require('../models/Notification');
    if (status === 'verified') {
      await Notification.create({
        userId: provider.userId,
        type: 'provider_verified',
        message: 'Your provider account has been verified!',
        data: { providerId: provider._id },
      });
    } else if (status === 'rejected') {
      await Notification.create({
        userId: provider.userId,
        type: 'provider_rejected',
        message: `Your provider account was rejected. Reason: ${reason || 'Not specified'}`,
        data: { providerId: provider._id, reason },
      });
    } else if (status === 'pending') {
      await Notification.create({
        userId: provider.userId,
        type: 'provider_reverted',
        message: `Your provider account status was changed to pending. Reason: ${reason || 'Not specified'}`,
        data: { providerId: provider._id, reason },
      });
    }

    res.json({
      message: `Provider ${status} successfully`,
      provider,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all jobs (for moderation)
const getAllJobsAdmin = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 10 } = req.query;

    let filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const skip = (page - 1) * limit;

    const jobs = await Job.find(filter)
      .populate('providerId')
      .skip(skip)
      .limit(parseInt(limit))
      .sort('-createdAt');

    const total = await Job.countDocuments(filter);

    res.json({
      jobs,
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

// Deactivate job
const deactivateJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(
      req.params.jobId,
      { isActive: false },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json({ message: 'Job deactivated successfully', job });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllUsers,
  toggleUserStatus,
  getPlatformStats,
  getAllProviders,
  getProviderById,
  downloadProviderDoc,
  verifyProvider,
  getAllJobsAdmin,
  deactivateJob,
};

