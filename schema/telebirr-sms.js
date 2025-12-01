const mongoose = require('mongoose');

const telebirrSmsSchema = new mongoose.Schema({
    reference_number: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    phone_number:  { type: String },
    paid: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

const TelebirrSms = mongoose.model('TelebirrSms', telebirrSmsSchema);

module.exports = { telebirrSmsSchema, TelebirrSms };