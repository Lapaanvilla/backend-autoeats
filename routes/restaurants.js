const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Restaurant = require('../models/Restaurant');

// @route   POST /api/restaurants/register
// @desc    Register a new restaurant
// @access  Public
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;

  try {
    // Check if restaurant already exists
    let existing = await Restaurant.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Restaurant already exists' });
    }

    // Create new restaurant
    const restaurant = new Restaurant({
      name,
      email,
      password,
      phone,
      isProfileComplete: false // default
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    restaurant.password = await bcrypt.hash(password, salt);

    // Save to DB
    await restaurant.save();

    // Create JWT payload
    const payload = {
      restaurant: { id: restaurant.id }
    };

    // Sign token and return
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '30d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// @route   PUT /api/restaurants/profile
// @desc    Update restaurant profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const {
      name,
      owner,
      phone,
      description,
      logo
    } = req.body;

    // Build profile object
    const profileFields = {};
    if (name) profileFields.name = name;
    if (owner) profileFields.owner = owner;
    if (phone) profileFields.phone = phone;
    if (description) profileFields.description = description;
    if (logo) profileFields.logo = logo;
    
    // Mark profile as complete if all required fields are provided
    if (name && phone && req.body.locations && req.body.locations.length > 0) {
      profileFields.isProfileComplete = true;
    }

    // Update restaurant profile
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.restaurant.id,
      { $set: profileFields },
      { new: true }
    ).select('-password');

    res.json(restaurant);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/restaurants/locations
// @desc    Update restaurant locations
// @access  Private
router.put('/locations', auth, async (req, res) => {
  try {
    const { locations } = req.body;

    // Validate locations
    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ message: 'At least one location is required' });
    }

    // Update restaurant locations
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.restaurant.id,
      { $set: { locations } },
      { new: true }
    ).select('-password');

    // Check if profile is now complete
    if (restaurant.name && restaurant.phone && restaurant.locations.length > 0 && !restaurant.isProfileComplete) {
      restaurant.isProfileComplete = true;
      await restaurant.save();
    }

    res.json(restaurant);
  } catch (error) {
    console.error('Update locations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/restaurants/menu
// @desc    Update restaurant menu
// @access  Private
router.put('/menu', auth, async (req, res) => {
  try {
    const { menu } = req.body;

    // Validate menu
    if (!menu || !Array.isArray(menu)) {
      return res.status(400).json({ message: 'Menu must be an array of categories' });
    }

    // Update restaurant menu
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.restaurant.id,
      { $set: { menu } },
      { new: true }
    ).select('-password');

    res.json(restaurant);
  } catch (error) {
    console.error('Update menu error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/restaurants/menu
// @desc    Get restaurant menu
// @access  Private
router.get('/menu', auth, async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.restaurant.id).select('menu');
    
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    
    res.json(restaurant.menu);
  } catch (error) {
    console.error('Get menu error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/restaurants/plan
// @desc    Update restaurant subscription plan
// @access  Private
router.put('/plan', auth, async (req, res) => {
  try {
    const { plan } = req.body;

    // Validate plan
    if (!plan || !['basic', 'executive'].includes(plan)) {
      return res.status(400).json({ message: 'Invalid plan type' });
    }

    // Update restaurant plan
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.restaurant.id,
      { $set: { plan } },
      { new: true }
    ).select('-password');

    res.json(restaurant);
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
