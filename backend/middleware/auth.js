const jwt = require('jsonwebtoken');
const Restaurant = require('../models/Restaurant');

module.exports = async function(req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add restaurant from payload to request
    req.restaurant = decoded;
    
    // Check if restaurant still exists in database
    const restaurant = await Restaurant.findById(decoded.id);
    if (!restaurant) {
      return res.status(401).json({ message: 'Token is not valid' });
    }
    
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};
