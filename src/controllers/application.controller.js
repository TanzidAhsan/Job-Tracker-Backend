const Application = require('../models/Application');
const Job = require('../models/Job');
const Provider = require('../models/Provider');
const Notification = require('../models/Notification');

// Create application
const createApplication = async (req, res) => {
  try {
    const { jobId, coverLetter, resumeUsed } = req.body;

    if (!jobId) {
      return res.status(400).json({ message: 'Job ID required' });
    }

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if already applied
    let application = await Application.findOne({
      userId: req.user._id,
      jobId,
    });
    if (application) {
      return res.status(400).json({ message: 'Already applied for this job' });
    }

    // Create application
    application = new Application({
      userId: req.user._id,
      jobId,
      providerId: job.providerId,
      coverLetter,
      resumeUsed,
    });

    // If resume uploaded (memory), attach binary to application
    if (req.file && req.file.buffer) {
      application.resume = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
        filename: req.file.originalname,
      };
    }

    await application.save();

    // Update applications count
    job.applicationsCount += 1;
    await job.save();

    // Create in-app notification for provider
    try {
      await Notification.create({
        userId: job.providerId,
        type: 'new_application',
        message: `New application for ${job.jobTitle}`,
        data: { applicationId: application._id, jobId: job._id },
      });
    } catch (e) {
      console.error('Notification create failed:', e.message);
    }

    res.status(201).json({
      message: 'Application submitted successfully',
      application,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all applications for user
const getUserApplications = async (req, res) => {
  try {
    const { status, jobId, page = 1, limit = 10, sortBy = '-appliedDate' } = req.query;

    let filter = { userId: req.user._id };
    if (status) filter.status = status;
    if (jobId) filter.jobId = jobId;

    const skip = (page - 1) * limit;

    const applications = await Application.find(filter)
      .populate('jobId')
      .populate('providerId')
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Application.countDocuments(filter);

    res.json({
      applications,
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

// Get application by ID
const getApplicationById = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('jobId')
      .populate('providerId', 'userId')
      .populate('userId');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check authorization: allow applicant owner, admin, or provider owning the application
    let isAuthorized = false;

    if (req.user.role === 'admin') {
      isAuthorized = true;
    } else if (application.userId && application.userId._id && application.userId._id.toString() === req.user._id.toString()) {
      // Applicant owner
      isAuthorized = true;
    } else if (req.user.role === 'provider') {
      // Provider must own the application (via job)
      // Get the provider ID from the populated providerId or use it directly
      let appProviderIdStr = null;
      
      if (application.providerId) {
        // If providerId is populated as an object
        if (typeof application.providerId === 'object' && application.providerId._id) {
          appProviderIdStr = application.providerId._id.toString();
        } else if (typeof application.providerId === 'string') {
          // If it's already a string ID
          appProviderIdStr = application.providerId;
        } else {
          // Try direct toString
          appProviderIdStr = application.providerId.toString();
        }
      }

      if (appProviderIdStr) {
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
        
        if (provider && provider._id.toString() === appProviderIdStr) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Unauthorized to view this application' });
    }

    res.json({ application, message: 'Application retrieved successfully' });
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Download application resume (with authorization)
const downloadApplicationResume = async (req, res) => {
  try {
    console.log('=== Download Resume Request ===');
    console.log('App ID:', req.params.id);
    console.log('User ID:', req.user._id);
    console.log('User Role:', req.user.role);
    
    const application = await Application.findById(req.params.id).populate('userId');
    if (!application) {
      console.log('Application not found');
      return res.status(404).json({ message: 'Application not found' });
    }
    
    console.log('Application found:', {
      appId: application._id,
      userId: application.userId?._id?.toString(),
      providerId: application.providerId?.toString(),
      hasAppResume: !!(application.resume?.data),
      hasUserResume: !!(application.userId?.resumeFile?.data)
    });

    // Authorization: allow applicant owner, admin, or provider owner
    let isAuthorized = false;
    let authReason = '';
    
    if (req.user.role === 'admin') {
      isAuthorized = true;
      authReason = 'admin role';
    } else if (application.userId && application.userId._id && application.userId._id.toString() === req.user._id.toString()) {
      isAuthorized = true;
      authReason = 'applicant owner';
    } else if (req.user.role === 'provider') {
      console.log('Checking provider authorization...');
      let provider = await Provider.findOne({ userId: req.user._id });
      console.log('Provider lookup result:', provider ? { providerId: provider._id } : 'Not found');
      
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
        console.log('Provider profile created:', provider._id);
      }
      
      if (provider && application.providerId) {
        const providerIdStr = provider._id.toString();
        // Handle both raw ID and populated object  
        let appProviderIdStr = null;
        if (typeof application.providerId === 'object' && application.providerId._id) {
          appProviderIdStr = application.providerId._id.toString();
        } else {
          appProviderIdStr = application.providerId.toString();
        }
        
        console.log('Comparing:', { providerIdStr, appProviderIdStr, match: providerIdStr === appProviderIdStr });
        
        if (providerIdStr === appProviderIdStr) {
          isAuthorized = true;
          authReason = 'provider owner';
        }
      }
    }
    
    console.log('Authorization result:', { isAuthorized, reason: authReason });
    
    if (!isAuthorized) {
      console.log('Authorization denied');
      return res.status(403).json({ message: 'Unauthorized to download this resume' });
    }

    // Try application resume first, then fall back to user's resume
    let resumeData = null;
    
    console.log('Checking for resume data...');
    console.log('Application resume exists:', !!(application.resume && application.resume.data));
    console.log('User resume exists:', !!(application.userId && application.userId.resumeFile && application.userId.resumeFile.data));
    
    if (application.resume && application.resume.data) {
      console.log('Using application-specific resume');
      resumeData = application.resume;
    } else if (application.userId && application.userId.resumeFile && application.userId.resumeFile.data) {
      console.log('Using user profile resume as fallback');
      resumeData = application.userId.resumeFile;
    }
    
    if (!resumeData) {
      console.log('No resume data found (application or user)');
      return res.status(404).json({ 
        message: 'Resume not available. The applicant has not uploaded a resume yet.',
        requiresResume: true
      });
    }

    console.log('Sending resume file...');
    res.contentType(resumeData.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${resumeData.filename || 'resume.pdf'}"`);
    return res.send(resumeData.data);
  } catch (error) {
    console.error('=== Download resume error ===', error);
    res.status(500).json({ message: 'Error downloading resume', error: error.message });
  }
};

// Update application status (Provider only)
const updateApplicationStatus = async (req, res) => {
  try {
    const { status, interviewDate, offerDetails, feedback } = req.body;

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check authorization
    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider || !application.providerId || provider._id.toString() !== application.providerId.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Validate status
    if (!['Applied', 'Interview', 'Offer', 'Rejected', 'Withdrawn'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    application.status = status;
    if (interviewDate) application.interviewDate = interviewDate;
    if (offerDetails) application.offerDetails = offerDetails;
    if (feedback) application.feedback = feedback;

    await application.save();

    res.json({ message: 'Application status updated', application });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete application
const deleteApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check authorization
    if (!application.userId || application.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await Application.deleteOne({ _id: req.params.id });

    // Update applications count
    const job = await Job.findById(application.jobId);
    if (job) {
      job.applicationsCount = Math.max(0, job.applicationsCount - 1);
      await job.save();
    }

    res.json({ message: 'Application deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user statistics
const getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const totalApplications = await Application.countDocuments({ userId });
    const appliedCount = await Application.countDocuments({
      userId,
      status: 'Applied',
    });
    const interviewCount = await Application.countDocuments({
      userId,
      status: 'Interview',
    });
    const offerCount = await Application.countDocuments({
      userId,
      status: 'Offer',
    });
    const rejectedCount = await Application.countDocuments({
      userId,
      status: 'Rejected',
    });

    res.json({
      totalApplications,
      applied: appliedCount,
      interviews: interviewCount,
      offers: offerCount,
      rejected: rejectedCount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createApplication,
  getUserApplications,
  getApplicationById,
  downloadApplicationResume,
  updateApplicationStatus,
  deleteApplication,
  getUserStats,
};
