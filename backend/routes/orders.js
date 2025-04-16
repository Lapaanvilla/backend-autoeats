const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');

// @route   POST /api/orders
// @desc    Create a new order
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const {
      customer,
      items,
      orderType,
      total,
      notes
    } = req.body;

    // Validate required fields
    if (!customer || !customer.name || !customer.phone) {
      return res.status(400).json({ message: 'Customer name and phone are required' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    if (!orderType || !['delivery', 'pickup'].includes(orderType)) {
      return res.status(400).json({ message: 'Order type must be delivery or pickup' });
    }

    if (orderType === 'delivery' && !customer.address) {
      return res.status(400).json({ message: 'Delivery address is required for delivery orders' });
    }

    // Create new order
    const newOrder = new Order({
      restaurant: req.restaurant.id,
      customer,
      items,
      orderType,
      total,
      notes,
      status: 'new'
    });

    const order = await newOrder.save();
    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders
// @desc    Get all orders for a restaurant
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    
    // Build query
    const query = { restaurant: req.restaurant.id };
    if (status && ['new', 'preparing', 'ready', 'delivered', 'cancelled'].includes(status)) {
      query.status = status;
    }
    
    // Get orders with pagination
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));
      
    // Get total count for pagination
    const total = await Order.countDocuments(query);
    
    res.json({
      orders,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      restaurant: req.restaurant.id
    });
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status
    if (!status || !['new', 'preparing', 'ready', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Find order and update status
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        restaurant: req.restaurant.id
      },
      {
        $set: {
          status,
          updatedAt: Date.now()
        }
      },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
