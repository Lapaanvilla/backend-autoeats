const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  customer: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    address: {
      type: String
    }
  },
  items: [{
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    customizations: [{
      name: {
        type: String
      },
      option: {
        type: String
      },
      price: {
        type: Number,
        default: 0
      }
    }]
  }],
  orderType: {
    type: String,
    enum: ['delivery', 'pickup'],
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'preparing', 'ready', 'delivered', 'cancelled'],
    default: 'new'
  },
  total: {
    type: Number,
    required: true
  },
  notes: {
    type: String
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

module.exports = mongoose.model('Order', orderSchema);
