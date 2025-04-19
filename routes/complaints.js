const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Complaint = require('../models/Complaint');

// @route   POST /api/complaints
// @desc    Create a new complaint
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const {
      customer,
      order,
      issue
    } = req.body;

    // Validate required fields
    if (!customer || !customer.name || !customer.phone) {
      return res.status(400).json({ message: 'Customer name and phone are required' });
    }

    if (!issue) {
      return res.status(400).json({ message: 'Issue description is required' });
    }

    // Create new complaint
    const newComplaint = new Complaint({
      restaurant: req.restaurant.id,
      customer,
      order,
      issue,
      status: 'new'
    });

    const complaint = await newComplaint.save();
    res.status(201).json(complaint);
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/complaints
// @desc    Get all complaints for a restaurant
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    
    // Build query
    const query = { restaurant: req.restaurant.id };
    if (status && ['new', 'in-progress', 'resolved'].includes(status)) {
      query.status = status;
    }
    
    // Get complaints with pagination
    const complaints = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));
      
    // Get total count for pagination
    const total = await Complaint.countDocuments(query);
    
    res.json({
      complaints,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip)
      }
    });
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/complaints/:id
// @desc    Get complaint by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      _id: req.params.id,
      restaurant: req.restaurant.id
    });
    
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    
    res.json(complaint);
  } catch (error) {
    console.error('Get complaint error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/complaints/:id/status
// @desc    Update complaint status
// @access  Private
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, resolution } = req.body;
    
    // Validate status
    if (!status || !['new', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Build update object
    const updateData = {
      status,
      updatedAt: Date.now()
    };
    
    // Add resolution if provided
    if (resolution) {
      updateData.resolution = resolution;
    }
    
    // Find complaint and update status
    const complaint = await Complaint.findOneAndUpdate(
      {
        _id: req.params.id,
        restaurant: req.restaurant.id
      },
      { $set: updateData },
      { new: true }
    );
    
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    
    res.json(complaint);
  } catch (error) {
    console.error('Update complaint status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
