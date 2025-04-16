const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Booking = require('../models/Booking');

// @route   POST /api/bookings
// @desc    Create a new table booking
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const {
      customer,
      date,
      time,
      guests,
      notes
    } = req.body;

    // Validate required fields
    if (!customer || !customer.name || !customer.phone) {
      return res.status(400).json({ message: 'Customer name and phone are required' });
    }

    if (!date || !time) {
      return res.status(400).json({ message: 'Date and time are required' });
    }

    if (!guests || guests < 1) {
      return res.status(400).json({ message: 'Number of guests must be at least 1' });
    }

    // Create new booking
    const newBooking = new Booking({
      restaurant: req.restaurant.id,
      customer,
      date,
      time,
      guests,
      notes,
      status: 'pending'
    });

    const booking = await newBooking.save();
    res.status(201).json(booking);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/bookings
// @desc    Get all bookings for a restaurant
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, date, limit = 50, skip = 0 } = req.query;
    
    // Build query
    const query = { restaurant: req.restaurant.id };
    if (status && ['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      query.status = status;
    }
    
    if (date) {
      // If date is provided, find bookings for that specific date
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      query.date = { $gte: startDate, $lte: endDate };
    }
    
    // Get bookings with pagination
    const bookings = await Booking.find(query)
      .sort({ date: 1, time: 1 })
      .limit(Number(limit))
      .skip(Number(skip));
      
    // Get total count for pagination
    const total = await Booking.countDocuments(query);
    
    res.json({
      bookings,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip)
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get booking by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      restaurant: req.restaurant.id
    });
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/bookings/:id/status
// @desc    Update booking status
// @access  Private
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, tableNumber } = req.body;
    
    // Validate status
    if (!status || !['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Build update object
    const updateData = {
      status,
      updatedAt: Date.now()
    };
    
    // Add table number if provided
    if (tableNumber) {
      updateData.tableNumber = tableNumber;
    }
    
    // Find booking and update status
    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        restaurant: req.restaurant.id
      },
      { $set: updateData },
      { new: true }
    );
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    res.json(booking);
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
