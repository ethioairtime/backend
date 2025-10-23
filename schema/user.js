const mongoose = require("mongoose");

// User schema and model
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    phone_number: { type: String, required: true },
    wallet: { type: Number, default: 0 }
});

const User = mongoose.model("User", userSchema);

module.exports = { userSchema, User };