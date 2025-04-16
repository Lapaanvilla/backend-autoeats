const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/whatsapp', require('./routes/whatsapp'));

// Basic route for testing
app.get('/', (req, res) => {
  res.send('AutoEats API is running...');
});

// Define port
const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
