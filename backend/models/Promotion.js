const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const promotionSchema = new Schema({
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  targetAudience: {
    type: String,
    enum: ['all', 'repeat', 'inactive'],
    default: 'all'
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sent'],
    default: 'draft'
  },
  scheduledDate: {
    type: Date
  },
  sentDate: {
    type: Date
  },
  recipients: {
    type: Number,
    default: 0
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

module.exports = mongoose.model('Promotion', promotionSchema);
