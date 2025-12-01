const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    phone_number: { type: String },
    sent: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = { orderSchema, Order };
