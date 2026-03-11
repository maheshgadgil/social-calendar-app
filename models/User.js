const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // bcrypt hashed
    email: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: '' },
    verificationExpiry: { type: Date },
    // Password reset
    resetToken: { type: String, default: '' },
    resetExpiry: { type: Date },
    // Admin & status
    isAdmin: { type: Boolean, default: false },
    isDisabled: { type: Boolean, default: false },
    // Profile fields
    bio: { type: String, default: '', maxlength: 250 },
    zipCode: { type: String, default: '' },
    serviceType: { type: String, default: '' },
    profileComplete: { type: Boolean, default: false },
    // Calendar fields
    joined: { type: Date, default: Date.now },
    availability: [{ type: String }],
    busySlots: [{ type: String }],
    slotPrices: { type: Map, of: Number, default: {} }
});

module.exports = mongoose.model('User', userSchema);
