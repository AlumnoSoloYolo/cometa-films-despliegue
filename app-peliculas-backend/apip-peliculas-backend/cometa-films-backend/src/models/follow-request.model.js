const mongoose = require('mongoose');

const followRequestSchema = new mongoose.Schema({
    // Usuario que solicita seguir
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Usuario al que se solicita seguir
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Índice compuesto para evitar duplicados
followRequestSchema.index({ requester: 1, recipient: 1 }, { unique: true });

module.exports = mongoose.model('FollowRequest', followRequestSchema);