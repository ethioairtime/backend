const mongoose = require('mongoose');

const cbeQueueSchema = new mongoose.Schema({
    reference_number: { type: String, required: true },
    amount: { type: Number, required: true },
    verified: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

const CbeQueue = mongoose.model('CbeQueue', cbeQueueSchema);

module.exports = { cbeQueueSchema, CbeQueue };

