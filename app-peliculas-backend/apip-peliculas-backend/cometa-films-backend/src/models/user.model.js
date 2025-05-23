const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    avatar: {
        type: String,
        default: 'avatar1'
    },
    biografia: {
        type: String,
        default: '',
        maxlength: 500
    },
    perfilPrivado: {
        type: Boolean,
        default: false
    },
    isPremium: {
        type: Boolean,
        default: false
    },
    premiumExpiry: {
        type: Date,
        default: null
    },
    paypalSubscriptionId: {
        type: String,
        default: null
    },
    premiumHistory: [{
        action: {
            type: String,
            enum: ['subscribed', 'renewed', 'canceled', 'expired']
        },
        date: {
            type: Date,
            default: Date.now
        },
        details: {
            type: String
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);