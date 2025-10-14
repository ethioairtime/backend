const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    email: { type: String, required: true },
    amount: { type: Number, required: true },
    phone_number: { type: String },
    status: { type: String, default: 'paid' },
    created_at: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = { orderSchema, Order };
