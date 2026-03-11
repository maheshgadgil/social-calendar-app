const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    username: { type: String, default: 'anonymous' },
    message: { type: String, required: true, maxlength: 1000 },
    rating: { type: Number, min: 1, max: 5, default: null },
    status: { type: String, default: 'new' }, // 'new' | 'reviewed'
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Feedback', feedbackSchema);
