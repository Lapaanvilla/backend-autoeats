const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Restaurant = require('../models/Restaurant');

// @route   POST /api/auth/register
// @desc    Register a new restaurant
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, owner, email, phone, password, plan } = req.body;

    // Check if restaurant already exists
    const existingRestaurant = await Restaurant.findOne({ email });
    if (existingRestaurant) {
      return res.status(400).json({ message: 'Restaurant with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new restaurant
    const restaurant = new Restaurant({
      name,
      owner,
      email,
      phone,
      password: hashedPassword,
      plan: plan || 'basic',
      locations: []
    });

    await restaurant.save();

    // Create JWT token
    const token = jwt.sign(
      { id: restaurant._id, role: restaurant.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        owner: restaurant.owner,
        email: restaurant.email,
        phone: restaurant.phone,
        plan: restaurant.plan,
        isProfileComplete: restaurant.isProfileComplete,
        role: restaurant.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate restaurant & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if restaurant exists
    const restaurant = await Restaurant.findOne({ email });
    if (!restaurant) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, restaurant.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: restaurant._id, role: restaurant.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        owner: restaurant.owner,
        email: restaurant.email,
        phone: restaurant.phone,
        plan: restaurant.plan,
        isProfileComplete: restaurant.isProfileComplete,
        role: restaurant.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current restaurant profile
// @access  Private
router.get('/me', async (req, res) => {
  try {
    // This route will be protected by auth middleware
    // which will add the restaurant ID to the request
    const restaurant = await Restaurant.findById(req.restaurant.id).select('-password');
    
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    
    res.json(restaurant);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
