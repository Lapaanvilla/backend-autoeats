const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const auth = require('../middleware/auth');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const Feedback = require('../models/Feedback');
const Complaint = require('../models/Complaint');
const Booking = require('../models/Booking');

// Store active sessions with expiry (30 minutes)
const sessions = {};

// Session cleanup interval (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  Object.keys(sessions).forEach(phone => {
    if (sessions[phone].expiry < now) {
      delete sessions[phone];
    }
  });
}, 10 * 60 * 1000);

// Helper to create a new session
const createSession = (phone, restaurantId, type = 'menu') => {
  sessions[phone] = {
    restaurantId,
    type,
    step: 1,
    data: {},
    expiry: Date.now() + 30 * 60 * 1000 // 30 minutes expiry
  };
  return sessions[phone];
};

// Helper to update session expiry
const updateSessionExpiry = (phone) => {
  if (sessions[phone]) {
    sessions[phone].expiry = Date.now() + 30 * 60 * 1000;
  }
};

// Helper to create WhatsApp button message
const createButtonMessage = (message, buttons) => {
  return JSON.stringify({
    type: 'button',
    body: message,
    buttons: buttons.map(button => ({
      type: 'reply',
      reply: {
        id: button.id,
        title: button.title
      }
    }))
  });
};

// @route   POST /api/whatsapp/webhook
// @desc    Handle incoming WhatsApp messages
// @access  Public
router.post('/webhook', async (req, res) => {
  try {
    const twiml = new MessagingResponse();
    const incomingMsg = req.body.Body;
    const from = req.body.From; // Format: whatsapp:+1234567890
    const phone = from.replace('whatsapp:', '');
    
    // Extract restaurant ID from To number
    // In a real implementation, you would have a mapping of Twilio numbers to restaurant IDs
    // For demo purposes, we'll extract from the request or use a default
    const to = req.body.To; // Format: whatsapp:+1234567890
    
    // Find restaurant by phone number (in real implementation)
    // For demo, we'll get the first restaurant
    const restaurant = await Restaurant.findOne();
    if (!restaurant) {
      twiml.message('Restaurant not found. Please try again later.');
      return res.type('text/xml').send(twiml.toString());
    }
    
    // Check if user has an active session
    let session = sessions[phone];
    
    // If no session exists or it's a greeting message, create a new session
    if (!session || /^(hi|hello|hey|start|menu|order)/i.test(incomingMsg)) {
      session = createSession(phone, restaurant._id);
      
      // Send welcome message with options
      const welcomeMsg = `👋 Welcome to ${restaurant.name}!\n\nHow can we help you today?`;
      const buttons = [
        { id: 'order', title: '🍔 Place Order' },
        { id: 'book', title: '📅 Book Table' },
        { id: 'feedback', title: '⭐ Leave Feedback' },
        { id: 'complaint', title: '❗ Register Complaint' }
      ];
      
      twiml.message().body(welcomeMsg);
      // In a real implementation with Twilio API, you would use:
      // client.messages.create({
      //   from: 'whatsapp:+1234567890',
      //   to: phone,
      //   body: welcomeMsg,
      //   contentSid: 'HXwxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' // Content SID for the button template
      // });
      
      return res.type('text/xml').send(twiml.toString());
    }
    
    // Update session expiry
    updateSessionExpiry(phone);
    
    // Handle button selection or initial command
    if (/^(order|book|feedback|complaint)$/i.test(incomingMsg) && session.step === 1) {
      session.type = incomingMsg.toLowerCase();
      session.step = 2;
      
      switch (session.type) {
        case 'order':
          // Fetch menu categories
          const restaurantData = await Restaurant.findById(session.restaurantId);
          const categories = restaurantData.menu.map(cat => cat.category);
          
          let menuMsg = "📋 *Menu Categories*\n\n";
          categories.forEach((cat, index) => {
            menuMsg += `${index + 1}. ${cat}\n`;
          });
          menuMsg += "\nPlease reply with the number of the category you'd like to see.";
          
          twiml.message(menuMsg);
          break;
          
        case 'book':
          twiml.message("📅 *Table Booking*\n\nPlease provide the following details:\n- Date (YYYY-MM-DD)\n- Time (HH:MM)\n- Number of guests\n\nExample: 2025-04-20 19:30 4");
          break;
          
        case 'feedback':
          twiml.message("⭐ *Feedback*\n\nPlease rate your experience from 1-5 stars and add any comments.\n\nExample: 5 The food was amazing and service was excellent!");
          break;
          
        case 'complaint':
          twiml.message("❗ *Register Complaint*\n\nPlease describe your issue in detail so we can address it properly.");
          break;
      }
      
      return res.type('text/xml').send(twiml.toString());
    }
    
    // Handle subsequent steps based on session type
    switch (session.type) {
      case 'order':
        await handleOrderFlow(session, incomingMsg, twiml, phone);
        break;
        
      case 'book':
        await handleBookingFlow(session, incomingMsg, twiml, phone);
        break;
        
      case 'feedback':
        await handleFeedbackFlow(session, incomingMsg, twiml, phone);
        break;
        
      case 'complaint':
        await handleComplaintFlow(session, incomingMsg, twiml, phone);
        break;
        
      default:
        twiml.message("I'm not sure what you're asking for. Please type 'menu' to start over.");
    }
    
    return res.type('text/xml').send(twiml.toString());
    
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    const twiml = new MessagingResponse();
    twiml.message('Sorry, something went wrong. Please try again later.');
    return res.type('text/xml').send(twiml.toString());
  }
});

// Handle order flow
async function handleOrderFlow(session, message, twiml, phone) {
  const restaurant = await Restaurant.findById(session.restaurantId);
  
  switch (session.step) {
    case 2: // Category selection
      const categoryIndex = parseInt(message) - 1;
      if (isNaN(categoryIndex) || categoryIndex < 0 || categoryIndex >= restaurant.menu.length) {
        twiml.message("Invalid selection. Please enter a valid category number.");
        return;
      }
      
      session.data.category = restaurant.menu[categoryIndex].category;
      session.data.items = [];
      session.step = 3;
      
      // Show items in the selected category
      const category = restaurant.menu[categoryIndex];
      let itemsMsg = `🍽️ *${category.category} Menu*\n\n`;
      category.items.forEach((item, index) => {
        itemsMsg += `${index + 1}. ${item.name} - $${item.price.toFixed(2)}\n`;
      });
      itemsMsg += "\nPlease reply with the number of the item you'd like to order.";
      
      twiml.message(itemsMsg);
      break;
      
    case 3: // Item selection
      const categoryObj = restaurant.menu.find(cat => cat.category === session.data.category);
      const itemIndex = parseInt(message) - 1;
      
      if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= categoryObj.items.length) {
        twiml.message("Invalid selection. Please enter a valid item number.");
        return;
      }
      
      const selectedItem = categoryObj.items[itemIndex];
      session.step = 4;
      
      twiml.message(`You selected: ${selectedItem.name} - $${selectedItem.price.toFixed(2)}\n\nHow many would you like to order?`);
      break;
      
    case 4: // Quantity selection
      const quantity = parseInt(message);
      if (isNaN(quantity) || quantity <= 0) {
        twiml.message("Please enter a valid quantity (a positive number).");
        return;
      }
      
      const categoryData = restaurant.menu.find(cat => cat.category === session.data.category);
      const itemIndexData = parseInt(session.data.itemIndex);
      
      // Add item to order
      session.data.items.push({
        name: categoryData.items[itemIndexData].name,
        price: categoryData.items[itemIndexData].price,
        quantity: quantity
      });
      
      session.step = 5;
      
      // Ask if they want to add more items
      twiml.message("Would you like to add more items to your order?\n\nReply with 'yes' to add more items or 'no' to proceed to checkout.");
      break;
      
    case 5: // Add more items?
      if (/^(yes|y)$/i.test(message)) {
        session.step = 2;
        
        // Show categories again
        const categories = restaurant.menu.map(cat => cat.category);
        let menuMsg = "📋 *Menu Categories*\n\n";
        categories.forEach((cat, index) => {
          menuMsg += `${index + 1}. ${cat}\n`;
        });
        menuMsg += "\nPlease reply with the number of the category you'd like to see.";
        
        twiml.message(menuMsg);
      } else if (/^(no|n)$/i.test(message)) {
        session.step = 6;
        
        // Calculate total
        let total = 0;
        let orderSummary = "🧾 *Order Summary*\n\n";
        session.data.items.forEach((item, index) => {
          const itemTotal = item.price * item.quantity;
          total += itemTotal;
          orderSummary += `${index + 1}. ${item.name} x${item.quantity} - $${itemTotal.toFixed(2)}\n`;
        });
        orderSummary += `\n*Total: $${total.toFixed(2)}*\n\nPlease select your order type:\n1. Delivery\n2. Pickup`;
        
        session.data.total = total;
        twiml.message(orderSummary);
      } else {
        twiml.message("Please reply with 'yes' to add more items or 'no' to proceed to checkout.");
      }
      break;
      
    case 6: // Delivery or pickup
      if (message === '1' || /^delivery$/i.test(message)) {
        session.data.orderType = 'delivery';
        session.step = 7;
        twiml.message("Please provide your delivery address.");
      } else if (message === '2' || /^pickup$/i.test(message)) {
        session.data.orderType = 'pickup';
        session.step = 8;
        twiml.message("Please provide your name for the pickup order.");
      } else {
        twiml.message("Invalid selection. Please reply with '1' for Delivery or '2' for Pickup.");
      }
      break;
      
    case 7: // Delivery address
      session.data.address = message;
      session.step = 8;
      twiml.message("Please provide your name for the order.");
      break;
      
    case 8: // Customer name
      session.data.customerName = message;
      session.step = 9;
      twiml.message("Please provide your phone number for order updates.");
      break;
      
    case 9: // Phone number
      session.data.customerPhone = message;
      session.step = 10;
      
      // Order confirmation
      let confirmationMsg = "📝 *Order Confirmation*\n\n";
      confirmationMsg += `Name: ${session.data.customerName}\n`;
      confirmationMsg += `Phone: ${session.data.customerPhone}\n`;
      if (session.data.orderType === 'delivery') {
        confirmationMsg += `Address: ${session.data.address}\n`;
      }
      confirmationMsg += `Order Type: ${session.data.orderType === 'delivery' ? 'Delivery' : 'Pickup'}\n\n`;
      
      // Items
      session.data.items.forEach((item, index) => {
        confirmationMsg += `${index + 1}. ${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}\n`;
      });
      
      confirmationMsg += `\n*Total: $${session.data.total.toFixed(2)}*\n\nPlease confirm your order by replying with 'confirm' or 'cancel' to start over.`;
      
      twiml.message(confirmationMsg);
      break;
      
    case 10: // Final confirmation
      if (/^(confirm|yes)$/i.test(message)) {
        // Create order in database
        const newOrder = new Order({
          restaurant: session.restaurantId,
          customer: {
            name: session.data.customerName,
            phone: session.data.customerPhone,
            address: session.data.address
          },
          items: session.data.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          orderType: session.data.orderType,
          total: session.data.total,
          status: 'new'
        });
        
        await newOrder.save();
        
        // Send confirmation
        twiml.message(`✅ Your order has been confirmed! Order #${newOrder._id.toString().slice(-6)}\n\nYou will receive updates on your order status. Thank you for ordering with us!`);
        
        // Clear session
        delete sessions[phone];
      } else if (/^(cancel|no)$/i.test(message)) {
        twiml.message("Your order has been cancelled. Type 'menu' to start over.");
        delete sessions[phone];
      } else {
        twiml.message("Please reply with 'confirm' to place your order or 'cancel' to start over.");
      }
      break;
  }
}

// Handle booking flow
async function handleBookingFlow(session, message, twiml, phone) {
  switch (session.step) {
    case 2: // Date, time and guests
      // Expected format: YYYY-MM-DD HH:MM X (where X is number of guests)
      const bookingRegex = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+(\d+)$/;
      const match = message.match(bookingRegex);
      
      if (!match) {
        twiml.message("Invalid format. Please provide date, time and number of guests in the format: YYYY-MM-DD HH:MM X\n\nExample: 2025-04-20 19:30 4");
        return;
      }
      
      const [_, date, time, guests] = match;
      session.data.date = date;
      session.data.time = time;
      session.data.guests = parseInt(guests);
      session.step = 3;
      
      twiml.message("Please provide your name for the reservation.");
      break;
      
    case 3: // Customer name
      session.data.customerName = message;
      session.step = 4;
      twiml.message("Please provide your phone number for reservation updates.");
      break;
      
    case 4: // Phone number
      session.data.customerPhone = message;
      session.step = 5;
      
      // Ask for special requests
      twiml.message("Do you have any special requests or notes for your reservation? (Type 'none' if none)");
      break;
      
    case 5: // Special requests
      session.data.notes = message === 'none' ? '' : message;
      session.step = 6;
      
      // Booking confirmation
      let confirmationMsg = "📝 *Reservation Confirmation*\n\n";
      confirmationMsg += `Name: ${session.data.customerName}\n`;
      confirmationMsg += `Phone: ${session.data.customerPhone}\n`;
      confirmationMsg += `Date: ${session.data.date}\n`;
      confirmationMsg += `Time: ${session.data.time}\n`;
      confirmationMsg += `Guests: ${session.data.guests}\n`;
      if (session.data.notes) {
        confirmationMsg += `Notes: ${session.data.notes}\n`;
      }
      
      confirmationMsg += `\nPlease confirm your reservation by replying with 'confirm' or 'cancel' to start over.`;
      
      twiml.message(confirmationMsg);
      break;
      
    case 6: // Final confirmation
      if (/^(confirm|yes)$/i.test(message)) {
        // Create booking in database
        const newBooking = new Booking({
          restaurant: session.restaurantId,
          customer: {
            name: session.data.customerName,
            phone: session.data.customerPhone
          },
          date: new Date(session.data.date),
          time: session.data.time,
          guests: session.data.guests,
          notes: session.data.notes,
          status: 'pending'
        });
        
        await newBooking.save();
        
        // Send confirmation
        twiml.message(`✅ Your reservation has been confirmed! Booking #${newBooking._id.toString().slice(-6)}\n\nWe look forward to seeing you on ${session.data.date} at ${session.data.time}. Thank you for choosing us!`);
        
        // Clear session
        delete sessions[phone];
      } else if (/^(cancel|no)$/i.test(message)) {
        twiml.message("Your reservation has been cancelled. Type 'menu' to start over.");
        delete sessions[phone];
      } else {
        twiml.message("Please reply with 'confirm' to make your reservation or 'cancel' to start over.");
      }
      break;
  }
}

// Handle feedback flow
async function handleFeedbackFlow(session, message, twiml, phone) {
  switch (session.step) {
    case 2: // Rating and comments
      // Expected format: X Comment (where X is rating 1-5)
      const feedbackRegex = /^([1-5])\s+(.+)$/;
      const match = message.match(feedbackRegex);
      
      if (!match) {
        twiml.message("Invalid format. Please provide your rating (1-5) followed by your comments.\n\nExample: 5 The food was amazing and service was excellent!");
        return;
      }
      
      const [_, rating, comment] = match;
      session.data.rating = parseInt(rating);
      session.data.comment = comment;
      session.step = 3;
      
      twiml.message("Please provide your name.");
      break;
      
    case 3: // Customer name
      session.data.customerName = message;
      session.step = 4;
      twiml.message("Please provide your phone number.");
      break;
      
    case 4: // Phone number
      session.data.customerPhone = message;
      session.step = 5;
      
      // Feedback confirmation
      let confirmationMsg = "📝 *Feedback Confirmation*\n\n";
      confirmationMsg += `Name: ${session.data.customerName}\n`;
      confirmationMsg += `Rating: ${'⭐'.repeat(session.data.rating)}\n`;
      confirmationMsg += `Comments: ${session.data.comment}\n`;
      
      confirmationMsg += `\nPlease confirm your feedback by replying with 'confirm' or 'cancel' to start over.`;
      
      twiml.message(confirmationMsg);
      break;
      
    case 5: // Final confirmation
      if (/^(confirm|yes)$/i.test(message)) {
        // Create feedback in database
        const newFeedback = new Feedback({
          restaurant: session.restaurantId,
          customer: {
            name: session.data.customerName,
            phone: session.data.customerPhone
          },
          rating: session.data.rating,
          comment: session.data.comment
        });
        
        await newFeedback.save();
        
        // Send confirmation
        twiml.message(`✅ Your feedback has been submitted! Thank you for sharing your experience with us.`);
        
        // Clear session
        delete sessions[phone];
      } else if (/^(cancel|no)$/i.test(message)) {
        twiml.message("Your feedback has been cancelled. Type 'menu' to start over.");
        delete sessions[phone];
      } else {
        twiml.message("Please reply with 'confirm' to submit your feedback or 'cancel' to start over.");
      }
      break;
  }
}

// Handle complaint flow
async function handleComplaintFlow(session, message, twiml, phone) {
  switch (session.step) {
    case 2: // Complaint details
      session.data.issue = message;
      session.step = 3;
      twiml.message("Please provide your name.");
      break;
      
    case 3: // Customer name
      session.data.customerName = message;
      session.step = 4;
      twiml.message("Please provide your phone number.");
      break;
      
    case 4: // Phone number
      session.data.customerPhone = message;
      session.step = 5;
      
      // Complaint confirmation
      let confirmationMsg = "📝 *Complaint Confirmation*\n\n";
      confirmationMsg += `Name: ${session.data.customerName}\n`;
      confirmationMsg += `Issue: ${session.data.issue}\n`;
      
      confirmationMsg += `\nPlease confirm your complaint by replying with 'confirm' or 'cancel' to start over.`;
      
      twiml.message(confirmationMsg);
      break;
      
    case 5: // Final confirmation
      if (/^(confirm|yes)$/i.test(message)) {
        // Create complaint in database
        const newComplaint = new Complaint({
          restaurant: session.restaurantId,
          customer: {
            name: session.data.customerName,
            phone: session.data.customerPhone
          },
          issue: session.data.issue,
          status: 'new'
        });
        
        await newComplaint.save();
        
        // Send confirmation
        twiml.message(`✅ Your complaint has been registered! Complaint #${newComplaint._id.toString().slice(-6)}\n\nWe take all complaints seriously and will address your concerns as soon as possible. A manager will contact you shortly.`);
        
        // Clear session
        delete sessions[phone];
      } else if (/^(cancel|no)$/i.test(message)) {
        twiml.message("Your complaint has been cancelled. Type 'menu' to start over.");
        delete sessions[phone];
      } else {
        twiml.message("Please reply with 'confirm' to register your complaint or 'cancel' to start over.");
      }
      break;
  }
}

// @route   POST /api/whatsapp/send
// @desc    Send WhatsApp message
// @access  Private
router.post('/send', auth, async (req, res) => {
  try {
    const { to, message } = req.body;
    
    // Validate required fields
    if (!to || !message) {
      return res.status(400).json({ message: 'Phone number and message are required' });
    }
    
    // In a real implementation, you would use Twilio client to send the message
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // const result = await client.messages.create({
    //   from: 'whatsapp:+1234567890',
    //   to: `whatsapp:${to}`,
    //   body: message
    // });
    
    // For demo purposes, we'll just return success
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Send WhatsApp message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/whatsapp/broadcast
// @desc    Send broadcast message to multiple recipients
// @access  Private
router.post('/broadcast', auth, async (req, res) => {
  try {
    const { recipients, message, promotionId } = req.body;
    
    // Validate required fields
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0 || !message) {
      return res.status(400).json({ message: 'Recipients array and message are required' });
    }
    
    // Check if restaurant has executive plan for broadcasts
    const restaurant = await Restaurant.findById(req.restaurant.id);
    if (restaurant.plan !== 'executive') {
      return res.status(403).json({ message: 'Broadcast messages are only available on the Executive Plan' });
    }
    
    // In a real implementation, you would use Twilio client to send messages
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // 
    // const results = await Promise.all(recipients.map(async (recipient) => {
    //   return client.messages.create({
    //     from: 'whatsapp:+1234567890',
    //     to: `whatsapp:${recipient}`,
    //     body: message
    //   });
    // }));
    
    // Update promotion if promotionId is provided
    if (promotionId) {
      await Promotion.findByIdAndUpdate(
        promotionId,
        {
          $set: {
            status: 'sent',
            sentDate: new Date(),
            recipients: recipients.length,
            updatedAt: Date.now()
          }
        }
      );
    }
    
    // For demo purposes, we'll just return success
    res.json({
      success: true,
      message: `Broadcast sent to ${recipients.length} recipients`,
      recipients: recipients.length
    });
  } catch (error) {
    console.error('Send broadcast message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
