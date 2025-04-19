const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Feedback = require('../models/Feedback');

// @route   POST /api/feedback
// @desc    Create a new feedback
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const {
      customer,
      order,
      rating,
      comment
    } = req.body;

    // Validate required fields
    if (!customer || !customer.name || !customer.phone) {
      return res.status(400).json({ message: 'Customer name and phone are required' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Create new feedback
    const newFeedback = new Feedback({
      restaurant: req.restaurant.id,
      customer,
      order,
      rating,
      comment
    });

    const feedback = await newFeedback.save();
    res.status(201).json(feedback);
  } catch (error) {
    console.error('Create feedback error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/feedback
// @desc    Get all feedback for a restaurant
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;
    
    // Get feedback with pagination
    const feedback = await Feedback.find({ restaurant: req.restaurant.id })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));
      
    // Get total count for pagination
    const total = await Feedback.countDocuments({ restaurant: req.restaurant.id });
    
    // Calculate average rating
    const ratingData = await Feedback.aggregate([
      { $match: { restaurant: req.restaurant.id } },
      { $group: { _id: null, averageRating: { $avg: "$rating" }, count: { $sum: 1 } } }
    ]);
    
    const averageRating = ratingData.length > 0 ? ratingData[0].averageRating : 0;
    
    res.json({
      feedback,
      stats: {
        averageRating,
        total
      },
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip)
      }
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/feedback/:id
// @desc    Get feedback by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const feedback = await Feedback.findOne({
      _id: req.params.id,
      restaurant: req.restaurant.id
    });
    
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    
    res.json(feedback);
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
