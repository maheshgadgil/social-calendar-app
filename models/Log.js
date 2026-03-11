const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    action: { type: String, required: true },   // e.g. 'REGISTER', 'LOGIN', 'TOGGLE_STATUS'
    actor: { type: String, default: 'system' }, // username performing the action
    target: { type: String, default: '' },      // affected username or entity
    detail: { type: String, default: '' },      // extra context
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', logSchema);
