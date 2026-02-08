const Job = require('../models/Job');
const Provider = require('../models/Provider');
const User = require('../models/User');

// Create job (Provider only)
const createJob = async (req, res) => {
  try {
    const {
      jobTitle,
      description,
      location,
      jobType,
      salary,
      experience,
      skills,
      qualification,
      deadline,
    } = req.body;

    // Check if provider exists; if not, try to create one from the user's data
    let provider = await Provider.findOne({ userId: req.user._id });
    if (!provider) {
      // If the authenticated user has provider role, auto-create a Provider profile
      if (req.user && req.user.role === 'provider') {
        const companyName = req.user.companyName || req.user.name || 'Provider';
        const companyEmail = req.user.email || '';

        provider = new Provider({
          userId: req.user._id,
          companyName,
          companyEmail,
        });

        await provider.save();
      } else {
        return res.status(404).json({ message: 'Provider profile not found' });
      }
    }

    // Check if provider is verified
    if (provider.verificationStatus !== 'verified') {
      return res.status(403).json({ 
        message: 'Your account must be verified by admin before posting jobs',
        verificationStatus: provider.verificationStatus
      });
    }

    const job = new Job({
      providerId: provider._id,
      jobTitle,
      description,
      location,
      jobType,
      salary,
      experience,
      skills,
      qualification,
      deadline,
    });

    await job.save();

    res.status(201).json({ message: 'Job posted successfully', job });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all jobs (with filters)
const getAllJobs = async (req, res) => {
  try {
    const {
      jobType,
      location,
      search,
      page = 1,
      limit = 10,
      sortBy = '-createdAt',
    } = req.query;

    let filter = { isActive: true };
    if (jobType) filter.jobType = jobType;
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (search) {
      filter.$or = [
        { jobTitle: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const jobs = await Job.find(filter)
      .populate('providerId')
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit));

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

// Get provider's jobs
const getProviderJobs = async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const jobs = await Job.find({ providerId: provider._id })
      .skip(skip)
      .limit(parseInt(limit))
      .sort('-createdAt');

    const total = await Job.countDocuments({ providerId: provider._id });

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

// Get job by ID
const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('providerId');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update job
const updateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider || provider._id.toString() !== job.providerId.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { jobTitle, description, location, jobType, salary, experience, skills, qualification, deadline } = req.body;

    job.jobTitle = jobTitle || job.jobTitle;
    job.description = description || job.description;
    job.location = location || job.location;
    job.jobType = jobType || job.jobType;
    if (salary) job.salary = salary;
    job.experience = experience || job.experience;
    if (skills) job.skills = skills;
    job.qualification = qualification || job.qualification;
    if (deadline) job.deadline = deadline;

    await job.save();

    res.json({ message: 'Job updated successfully', job });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete job
const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider || provider._id.toString() !== job.providerId.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    job.isActive = false;
    await job.save();

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createJob,
  getAllJobs,
  getProviderJobs,
  getJobById,
  updateJob,
  deleteJob,
};
