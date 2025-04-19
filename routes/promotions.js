const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Promotion = require('../models/Promotion');
const Restaurant = require('../models/Restaurant');

// @route   POST /api/promotions
// @desc    Create a new promotion
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      message,
      targetAudience,
      status,
      scheduledDate
    } = req.body;

    // Validate required fields
    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    // Validate target audience
    if (!targetAudience || !['all', 'repeat', 'inactive'].includes(targetAudience)) {
      return res.status(400).json({ message: 'Invalid target audience' });
    }

    // Validate status
    if (!status || !['draft', 'scheduled', 'sent'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Check if restaurant has executive plan for promotions
    const restaurant = await Restaurant.findById(req.restaurant.id);
    if (restaurant.plan !== 'executive') {
      return res.status(403).json({ message: 'Promotions are only available on the Executive Plan' });
    }

    // Validate scheduled date if status is scheduled
    if (status === 'scheduled' && !scheduledDate) {
      return res.status(400).json({ message: 'Scheduled date is required for scheduled promotions' });
    }

    // Create new promotion
    const newPromotion = new Promotion({
      restaurant: req.restaurant.id,
      title,
      message,
      targetAudience,
      status,
      scheduledDate: status === 'scheduled' ? new Date(scheduledDate) : undefined,
      sentDate: status === 'sent' ? new Date() : undefined,
      recipients: status === 'sent' ? Math.floor(Math.random() * 200) + 50 : 0 // Mock data for demo
    });

    const promotion = await newPromotion.save();
    res.status(201).json(promotion);
  } catch (error) {
    console.error('Create promotion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/promotions
// @desc    Get all promotions for a restaurant
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    
    // Build query
    const query = { restaurant: req.restaurant.id };
    if (status && ['draft', 'scheduled', 'sent'].includes(status)) {
      query.status = status;
    }
    
    // Get promotions with pagination
    const promotions = await Promotion.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));
      
    // Get total count for pagination
    const total = await Promotion.countDocuments(query);
    
    res.json({
      promotions,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip)
      }
    });
  } catch (error) {
    console.error('Get promotions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/promotions/:id
// @desc    Get promotion by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({
      _id: req.params.id,
      restaurant: req.restaurant.id
    });
    
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    
    res.json(promotion);
  } catch (error) {
    console.error('Get promotion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/promotions/:id
// @desc    Update promotion
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      title,
      message,
      targetAudience,
      status,
      scheduledDate
    } = req.body;
    
    // Find promotion
    const promotion = await Promotion.findOne({
      _id: req.params.id,
      restaurant: req.restaurant.id
    });
    
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    
    // Can only edit draft promotions
    if (promotion.status !== 'draft' && req.body.status !== 'scheduled') {
      return res.status(400).json({ message: 'Only draft promotions can be edited' });
    }
    
    // Update fields
    if (title) promotion.title = title;
    if (message) promotion.message = message;
    if (targetAudience && ['all', 'repeat', 'inactive'].includes(targetAudience)) {
      promotion.targetAudience = targetAudience;
    }
    
    // Update status and related fields
    if (status && ['draft', 'scheduled', 'sent'].includes(status)) {
      promotion.status = status;
      
      if (status === 'scheduled' && scheduledDate) {
        promotion.scheduledDate = new Date(scheduledDate);
      }
      
      if (status === 'sent') {
        promotion.sentDate = new Date();
        promotion.recipients = Math.floor(Math.random() * 200) + 50; // Mock data for demo
      }
    }
    
    promotion.updatedAt = Date.now();
    await promotion.save();
    
    res.json(promotion);
  } catch (error) {
    console.error('Update promotion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/promotions/:id
// @desc    Delete a promotion
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const promotion = await Promotion.findOne({
      _id: req.params.id,
      restaurant: req.restaurant.id
    });
    
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    
    // Can only delete draft promotions
    if (promotion.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft promotions can be deleted' });
    }
    
    await promotion.remove();
    res.json({ message: 'Promotion removed' });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
