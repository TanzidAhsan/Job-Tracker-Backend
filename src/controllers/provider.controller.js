const Provider = require('../models/Provider');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');

// Create provider profile
const createProviderProfile = async (req, res) => {
  try {
    const {
      companyName,
      companyEmail,
      companyPhone,
      companyWebsite,
      industry,
      location,
      companyLogo,
      description,
      employeeCount,
    } = req.body;

    // Check if provider already exists
    let provider = await Provider.findOne({ userId: req.user._id });
    if (provider) {
      return res.status(400).json({ message: 'Provider profile already exists' });
    }

    provider = new Provider({
      userId: req.user._id,
      companyName,
      companyEmail,
      companyPhone,
      companyWebsite,
      industry,
      location,
      companyLogo,
      description,
      employeeCount,
    });

    await provider.save();

    res.status(201).json({
      message: 'Provider profile created successfully',
      provider,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get provider profile
const getProviderProfile = async (req, res) => {
  try {
    console.log('Fetching provider profile for user:', req.user._id);
    let provider = await Provider.findOne({ userId: req.user._id }).populate('userId');

    // Auto-create provider profile if doesn't exist
    if (!provider && req.user.role === 'provider') {
      console.log('Auto-creating provider profile...');
      provider = new Provider({
        userId: req.user._id,
        companyName: req.user.companyName || req.user.name || 'Provider',
        companyEmail: req.user.companyEmail || req.user.email,
        verificationStatus: 'pending',
      });
      await provider.save();
      await provider.populate('userId');
      console.log('Provider profile created:', provider._id);
    }

    if (!provider) {
      console.log('No provider profile found for user:', req.user._id);
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    console.log('Provider profile found:', { 
      providerId: provider._id, 
      verificationStatus: provider.verificationStatus,
      docsCount: provider.companyDocs?.length || 0
    });
    
    res.json(provider);
  } catch (error) {
    console.error('Error fetching provider profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a provider document by index (provider only)
const deleteProviderDoc = async (req, res) => {
  try {
    const { docId } = req.params;
    const idx = parseInt(docId, 10);
    if (Number.isNaN(idx)) return res.status(400).json({ message: 'Invalid document id' });

    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider) return res.status(404).json({ message: 'Provider profile not found' });

    if (!provider.companyDocs || idx < 0 || idx >= provider.companyDocs.length) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // remove the document at index
    provider.companyDocs.splice(idx, 1);
    await provider.save();

    res.json({ message: 'Document removed', provider });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update provider profile
const updateProviderProfile = async (req, res) => {
  try {
    const {
      companyName,
      companyEmail,
      companyPhone,
      companyWebsite,
      industry,
      location,
      companyLogo,
      description,
      employeeCount,
    } = req.body;

    // Upsert provider record so providers without a profile can update/create
    const provider = await Provider.findOneAndUpdate(
      { userId: req.user._id },
      {
        companyName,
        companyEmail,
        companyPhone,
        companyWebsite,
        industry,
        location,
        // companyLogo field will be overwritten below if a file is uploaded
        companyLogo,
        description,
        employeeCount,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    // Handle uploaded company documents if present (memory upload)
    if (req.files && req.files.companyDocs && Array.isArray(req.files.companyDocs) && req.files.companyDocs.length) {
      provider.companyDocs = provider.companyDocs || [];
      const uploaded = req.files.companyDocs.map((f) => ({
        filename: f.originalname,
        contentType: f.mimetype,
        data: f.buffer,
      }));
      // append new docs
      provider.companyDocs = provider.companyDocs.concat(uploaded);
      await provider.save();
    }

    // Handle uploaded company logo (store filename)
    if (req.files && req.files.companyLogo && req.files.companyLogo[0]) {
      const logoFile = req.files.companyLogo[0];
      provider.companyLogo = logoFile.originalname || provider.companyLogo;
      await provider.save();
    }

    // Update corresponding User fields if provided (companyName/companyEmail)
    const UserModel = require('../models/User');
    const userUpdates = {};
    if (companyName) userUpdates.companyName = companyName;
    if (companyEmail) userUpdates.companyEmail = companyEmail;
    if (Object.keys(userUpdates).length) {
      await UserModel.findByIdAndUpdate(req.user._id, userUpdates);
    }

    // If caller asked to resubmit, set verificationStatus to pending and notify admins
    if (req.body && req.body.resubmit === true) {
      provider.verificationStatus = 'pending';
      await provider.save();

      const Notification = require('../models/Notification');
      const admins = await User.find({ role: 'admin' }).select('_id');
      if (admins && admins.length) {
        const notifications = admins.map((a) => ({
          userId: a._id,
          type: 'provider_resubmitted',
          message: `Provider ${provider.companyName || 'Unnamed'} has resubmitted for verification`,
          data: { providerId: provider._id },
        }));
        await Notification.insertMany(notifications);
      }
    }

    res.json({
      message: 'Provider profile updated successfully',
      provider,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Resubmit provider profile for verification (Provider only)
const resubmitProviderProfile = async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    provider.verificationStatus = 'pending';
    await provider.save();

    // Notify all admins about resubmission
    const Notification = require('../models/Notification');
    const User = require('../models/User');
    const admins = await User.find({ role: 'admin' }).select('_id');
    if (admins && admins.length) {
      const notifications = admins.map((a) => ({
        userId: a._id,
        type: 'provider_resubmitted',
        message: `Provider ${provider.companyName || 'Unnamed'} has resubmitted for verification`,
        data: { providerId: provider._id },
      }));
      await Notification.insertMany(notifications);
    }

    res.json({ message: 'Provider resubmitted for verification', provider });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get applicants for provider
const getProviderApplicants = async (req, res) => {
  try {
    let provider = await Provider.findOne({ userId: req.user._id });
    
    // Auto-create provider profile if doesn't exist
    if (!provider && req.user.role === 'provider') {
      provider = new Provider({
        userId: req.user._id,
        companyName: req.user.companyName || req.user.name || 'Provider',
        companyEmail: req.user.companyEmail || req.user.email,
        verificationStatus: 'pending',
      });
      await provider.save();
    }
    
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    const { jobId, status, page = 1, limit = 10 } = req.query;

    let filter = { providerId: provider._id };
    if (jobId) filter.jobId = jobId;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const applicants = await Application.find(filter)
      .populate('userId')
      .populate('jobId')
      .skip(skip)
      .limit(parseInt(limit))
      .sort('-appliedDate');

    const total = await Application.countDocuments(filter);

    res.json({
      applicants,
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

// Get provider statistics
const getProviderStats = async (req, res) => {
  try {
    let provider = await Provider.findOne({ userId: req.user._id });
    
    // Auto-create provider profile if doesn't exist
    if (!provider && req.user.role === 'provider') {
      provider = new Provider({
        userId: req.user._id,
        companyName: req.user.companyName || req.user.name || 'Provider',
        companyEmail: req.user.companyEmail || req.user.email,
        verificationStatus: 'pending',
      });
      await provider.save();
    }
    
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    const totalJobs = await Job.countDocuments({ providerId: provider._id });
    const totalApplicants = await Application.countDocuments({
      providerId: provider._id,
    });
    const offersMade = await Application.countDocuments({
      providerId: provider._id,
      status: 'Offer',
    });
    const interviewsScheduled = await Application.countDocuments({
      providerId: provider._id,
      status: 'Interview',
    });

    res.json({
      totalJobs,
      totalApplicants,
      offersMade,
      interviewsScheduled,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createProviderProfile,
  getProviderProfile,
  updateProviderProfile,
  resubmitProviderProfile,
  getProviderApplicants,
  getProviderStats,
};
