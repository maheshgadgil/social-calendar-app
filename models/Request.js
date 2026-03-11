const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    from: { type: String, required: true },
    to: { type: String, required: true },
    day: { type: String, required: true },
    time: { type: String, required: true },
    serviceDescription: { type: String, default: '' }, // What service is being requested
    status: { type: String, default: 'pending' },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Request', requestSchema);
