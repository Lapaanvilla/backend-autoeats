const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const restaurantSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  owner: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  logo: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  locations: [{
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    province: {
      type: String,
      required: true
    },
    postalCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      default: 'Canada'
    },
    phone: {
      type: String
    }
  }],
  menu: [{
    category: {
      type: String,
      required: true
    },
    items: [{
      name: {
        type: String,
        required: true
      },
      description: {
        type: String
      },
      price: {
        type: Number,
        required: true
      },
      image: {
        type: String
      },
      available: {
        type: Boolean,
        default: true
      },
      customizations: [{
        name: {
          type: String
        },
        options: [{
          name: {
            type: String
          },
          price: {
            type: Number,
            default: 0
          }
        }]
      }]
    }]
  }],
  plan: {
    type: String,
    enum: ['basic', 'executive'],
    default: 'basic'
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['admin', 'manager'],
    default: 'admin'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Restaurant', restaurantSchema);
