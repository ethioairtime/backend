const mongoose = require('mongoose');

const cbeQueueSchema = new mongoose.Schema({
    reference_number: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    phone_number:  { type: String, unique: true },
    paid: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

const CbeQueue = mongoose.model('CbeQueue', cbeQueueSchema);

module.exports = { cbeQueueSchema, CbeQueue };

